use crate::probe::normalize_media_path;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::Duration;

/// Incremented every time the worker finishes a decode job.
static FRAME_GENERATION: AtomicU64 = AtomicU64::new(0);
/// Set when a render was served a stale/placeholder frame because the exact one was still decoding.
static STALE_FRAME_SERVED: AtomicBool = AtomicBool::new(false);

/// Number of decode jobs finished so far. Compare two readings to detect newly decoded frames.
pub fn frame_generation() -> u64 {
    FRAME_GENERATION.load(Ordering::Acquire)
}

/// Returns `true` (and clears the flag) if any frame request since the last call returned a stale
/// frame while the exact one was still decoding. The UI uses this to schedule a repaint once the
/// decoder catches up, so a paused seek doesn't stay stuck on the pre-seek frame.
pub fn take_stale_frame_flag() -> bool {
    STALE_FRAME_SERVED.swap(false, Ordering::AcqRel)
}

#[derive(Debug, Clone)]
pub struct DecodedVideoFrame {
    pub width: u32,
    pub height: u32,
    pub timestamp_sec: f64,
    pub bgra_bytes: Vec<u8>,
}

const BUCKET_FPS: f64 = 15.0;
/// Memory budget for decoded frames (~21 frames of 1080p landscape preview at 1.48 MB each).
/// Playback only needs the current frame per stream; the rest speeds up short back-scrubs.
const FRAME_CACHE_BUDGET_BYTES: usize = 32 * 1024 * 1024;
/// Upper bound on concurrently open `IMFSourceReader` sessions. Each software H.264 decoder
/// holds ~60 MB of reference frames and buffers.
const MAX_OPEN_SESSIONS: usize = 4;
/// Decoder sessions unused for this long are closed to give their memory back.
#[cfg(target_os = "windows")]
const SESSION_IDLE_TIMEOUT: Duration = Duration::from_secs(15);
/// Reserved stream key for Media Bin thumbnails. Thumbnails are decoded on their own reader
/// and pinned outside the LRU so they never seek or evict the timeline playback streams.
const THUMBNAIL_STREAM: &str = "__thumbnail__";

/// One decode job. `stream` identifies an independent reader (usually a timeline clip id),
/// so two clips that use the same file do not cancel each other's jobs or fight over one seek position.
#[derive(Debug, Clone, PartialEq, Eq)]
struct DecodeJob {
    path: String,
    stream: String,
    bucket: i64,
}

struct FrameCacheState {
    frames: HashMap<(String, i64), Arc<DecodedVideoFrame>>,
    lru_order: VecDeque<(String, i64)>,
    latest_by_stream: HashMap<(String, String), Arc<DecodedVideoFrame>>,
    thumbnails: HashMap<String, Arc<DecodedVideoFrame>>,
    pending_jobs: VecDeque<DecodeJob>,
    failed_sources: HashMap<String, bool>,
    cached_bytes: usize,
    /// Job the worker is decoding right now. Repaints re-request the same frame while it is being
    /// decoded; those requests must not be queued again, or the worker treats its own target as
    /// "superseded", stops early, re-seeks, and the preview loops between keyframe and partial frames.
    in_flight: Option<DecodeJob>,
}

impl FrameCacheState {
    fn new() -> Self {
        Self {
            cached_bytes: 0,
            in_flight: None,
            frames: HashMap::new(),
            lru_order: VecDeque::new(),
            latest_by_stream: HashMap::new(),
            thumbnails: HashMap::new(),
            pending_jobs: VecDeque::new(),
            failed_sources: HashMap::new(),
        }
    }

    fn insert_frame(&mut self, job: &DecodeJob, frame: Arc<DecodedVideoFrame>) {
        if job.stream == THUMBNAIL_STREAM {
            self.thumbnails.insert(job.path.clone(), frame);
            return;
        }
        let key = (job.path.clone(), job.bucket);
        match self.frames.insert(key.clone(), frame.clone()) {
            Some(old) => self.cached_bytes -= old.bgra_bytes.len(),
            None => self.lru_order.push_back(key),
        }
        self.cached_bytes += frame.bgra_bytes.len();
        // Evict oldest frames over budget, always keeping the newest one.
        while self.cached_bytes > FRAME_CACHE_BUDGET_BYTES && self.lru_order.len() > 1 {
            if let Some(old_key) = self.lru_order.pop_front()
                && let Some(old) = self.frames.remove(&old_key)
            {
                self.cached_bytes -= old.bgra_bytes.len();
            }
        }
        self.latest_by_stream
            .insert((job.path.clone(), job.stream.clone()), frame);
    }

    /// Queues a job, replacing any older queued job for the same stream so the worker
    /// always decodes the most recent position.
    fn enqueue(&mut self, job: DecodeJob) {
        self.pending_jobs
            .retain(|j| !(j.path == job.path && j.stream == job.stream));
        self.pending_jobs.push_back(job);
    }
}

struct DecoderService {
    state: Mutex<FrameCacheState>,
    job_cvar: Condvar,
    result_cvar: Condvar,
}

static DECODER_SERVICE: OnceLock<Arc<DecoderService>> = OnceLock::new();

fn get_decoder_service() -> &'static Arc<DecoderService> {
    DECODER_SERVICE.get_or_init(|| {
        let svc = Arc::new(DecoderService {
            state: Mutex::new(FrameCacheState::new()),
            job_cvar: Condvar::new(),
            result_cvar: Condvar::new(),
        });

        let svc_worker = svc.clone();
        std::thread::Builder::new()
            .name("predit-video-decoder".into())
            .spawn(move || {
                decoder_worker_loop(svc_worker);
            })
            .ok();

        svc
    })
}

/// Output pixel format delivered by the source reader.
#[cfg(target_os = "windows")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PixelFormat {
    /// Native decoder output for 8-bit H.264 / HEVC. Converted to BGRA here, and only for the
    /// frame that is actually shown (frames skipped while seeking forward are never converted).
    Nv12,
    /// Fallback for sources with no NV12 output (10-bit HEVC, uncompressed AVI, ...). Media
    /// Foundation's video processor converts every decoded frame to RGB32, about 4x slower.
    Rgb32,
}

/// Fixed-point (16.16) YUV -> RGB coefficients.
#[cfg(target_os = "windows")]
#[derive(Clone, Copy, Debug)]
struct YuvCoeffs {
    y_off: i32,
    y: i32,
    rv: i32,
    gu: i32,
    gv: i32,
    bu: i32,
}

#[cfg(target_os = "windows")]
impl YuvCoeffs {
    fn new(bt709: bool, full_range: bool) -> Self {
        let f = |v: f64| (v * 65536.0).round() as i32;
        let (y_off, y) = if full_range {
            (0, f(1.0))
        } else {
            (16, f(255.0 / 219.0))
        };
        let s = if full_range { 1.0 } else { 255.0 / 224.0 };
        let (rv, gu, gv, bu) = if bt709 {
            (1.5748, 0.187324, 0.468124, 1.8556)
        } else {
            (1.402, 0.344136, 0.714136, 1.772)
        };
        Self {
            y_off,
            y,
            rv: f(rv * s),
            gu: f(gu * s),
            gv: f(gv * s),
            bu: f(bu * s),
        }
    }
}

/// Geometry and color description of the reader's current output type.
#[cfg(target_os = "windows")]
#[derive(Clone, Copy, Debug)]
struct VideoFormatInfo {
    /// Allocated buffer size (may be padded, e.g. 1920x1088).
    width: u32,
    height: u32,
    /// Visible picture inside the buffer (`MF_MT_MINIMUM_DISPLAY_APERTURE`).
    crop_x: u32,
    crop_y: u32,
    crop_w: u32,
    crop_h: u32,
    default_stride: i32,
    coeffs: YuvCoeffs,
}

#[cfg(target_os = "windows")]
struct MfVideoSession {
    reader: windows::Win32::Media::MediaFoundation::IMFSourceReader,
    stream_idx: u32,
    format: PixelFormat,
    info: VideoFormatInfo,
    dur_ticks: i64,
    last_pts_ticks: i64,
}

/// Preview frames are downscaled to at most this height.
#[cfg(target_os = "windows")]
const MAX_PREVIEW_HEIGHT: usize = 540;

#[cfg(target_os = "windows")]
unsafe fn create_video_reader(
    clean_path: &str,
    subtype: &windows::core::GUID,
    video_processing: bool,
) -> Option<windows::Win32::Media::MediaFoundation::IMFSourceReader> {
    use windows::{
        Win32::Media::MediaFoundation::{
            IMFAttributes, IMFMediaType, MF_MT_MAJOR_TYPE, MF_MT_SUBTYPE,
            MF_SOURCE_READER_ALL_STREAMS, MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING,
            MF_SOURCE_READER_FIRST_VIDEO_STREAM, MFCreateAttributes, MFCreateMediaType,
            MFCreateSourceReaderFromURL, MFMediaType_Video,
        },
        core::HSTRING,
    };

    unsafe {
        let mut attrs: Option<IMFAttributes> = None;
        MFCreateAttributes(&mut attrs, 2).ok()?;
        let attrs = attrs?;
        if video_processing {
            attrs
                .SetUINT32(&MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, 1)
                .ok()?;
        }

        let reader = MFCreateSourceReaderFromURL(&HSTRING::from(clean_path), &attrs).ok()?;
        let stream_idx = MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32;

        // Only read video. Selected-but-unread streams (audio) make the reader queue their
        // samples in memory while we pull video frames.
        let _ = reader.SetStreamSelection(MF_SOURCE_READER_ALL_STREAMS.0 as u32, false);
        reader.SetStreamSelection(stream_idx, true).ok()?;

        let out_type: IMFMediaType = MFCreateMediaType().ok()?;
        out_type
            .SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)
            .ok()?;
        out_type.SetGUID(&MF_MT_SUBTYPE, subtype).ok()?;
        reader
            .SetCurrentMediaType(stream_idx, None, &out_type)
            .ok()?;
        Some(reader)
    }
}

#[cfg(target_os = "windows")]
unsafe fn read_video_format(
    reader: &windows::Win32::Media::MediaFoundation::IMFSourceReader,
    stream_idx: u32,
    format: PixelFormat,
) -> Option<VideoFormatInfo> {
    use windows::Win32::Media::MediaFoundation::{
        MF_MT_DEFAULT_STRIDE, MF_MT_FRAME_SIZE, MF_MT_MINIMUM_DISPLAY_APERTURE,
        MF_MT_VIDEO_NOMINAL_RANGE, MF_MT_YUV_MATRIX, MFNominalRange_0_255, MFVideoArea,
        MFVideoTransferMatrix_BT601, MFVideoTransferMatrix_BT709,
    };

    unsafe {
        let media_type = reader.GetCurrentMediaType(stream_idx).ok()?;
        let frame_size = media_type.GetUINT64(&MF_MT_FRAME_SIZE).ok()?;
        let width = (frame_size >> 32) as u32;
        let height = (frame_size & 0xFFFF_FFFF) as u32;
        if width == 0 || height == 0 {
            return None;
        }

        let bytes_per_px = if format == PixelFormat::Nv12 { 1 } else { 4 };
        let default_stride = media_type
            .GetUINT32(&MF_MT_DEFAULT_STRIDE)
            .map(|v| v as i32)
            .unwrap_or((width * bytes_per_px) as i32);

        let (mut crop_x, mut crop_y, mut crop_w, mut crop_h) = (0, 0, width, height);
        let mut area = MFVideoArea::default();
        let area_bytes = std::slice::from_raw_parts_mut(
            &mut area as *mut MFVideoArea as *mut u8,
            std::mem::size_of::<MFVideoArea>(),
        );
        if media_type
            .GetBlob(&MF_MT_MINIMUM_DISPLAY_APERTURE, area_bytes, None)
            .is_ok()
        {
            let x = area.OffsetX.value.max(0) as u32;
            let y = area.OffsetY.value.max(0) as u32;
            let w = area.Area.cx.max(0) as u32;
            let h = area.Area.cy.max(0) as u32;
            if w > 0 && h > 0 && x + w <= width && y + h <= height {
                (crop_x, crop_y, crop_w, crop_h) = (x, y, w, h);
            }
        }

        // Untagged files: HD and larger are BT.709, SD is BT.601 (same rule players use).
        let bt709 = match media_type.GetUINT32(&MF_MT_YUV_MATRIX).ok() {
            Some(m) if m == MFVideoTransferMatrix_BT601.0 as u32 => false,
            Some(m) if m == MFVideoTransferMatrix_BT709.0 as u32 => true,
            _ => crop_h.min(crop_w) >= 720,
        };
        let full_range = media_type.GetUINT32(&MF_MT_VIDEO_NOMINAL_RANGE).ok()
            == Some(MFNominalRange_0_255.0 as u32);

        Some(VideoFormatInfo {
            width,
            height,
            crop_x,
            crop_y,
            crop_w,
            crop_h,
            default_stride,
            coeffs: YuvCoeffs::new(bt709, full_range),
        })
    }
}

#[cfg(target_os = "windows")]
fn open_mf_video_session(clean_path: &str) -> Option<MfVideoSession> {
    use windows::Win32::Media::MediaFoundation::{
        MF_PD_DURATION, MF_SOURCE_READER_FIRST_VIDEO_STREAM, MF_SOURCE_READER_MEDIASOURCE,
        MFVideoFormat_NV12, MFVideoFormat_RGB32,
    };

    unsafe {
        // Prefer the decoder's native NV12 output; fall back to RGB32 through the video processor.
        let (reader, format) = match create_video_reader(clean_path, &MFVideoFormat_NV12, false) {
            Some(r) => (r, PixelFormat::Nv12),
            None => (
                create_video_reader(clean_path, &MFVideoFormat_RGB32, true)?,
                PixelFormat::Rgb32,
            ),
        };
        let stream_idx = MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32;
        let info = read_video_format(&reader, stream_idx, format)?;

        let dur_ticks = reader
            .GetPresentationAttribute(MF_SOURCE_READER_MEDIASOURCE.0 as u32, &MF_PD_DURATION)
            .ok()
            .map(|prop| {
                let raw_ptr = (&prop as *const _ as *const u8).add(8) as *const i64;
                *raw_ptr
            })
            .unwrap_or(i64::MAX / 4);

        Some(MfVideoSession {
            reader,
            stream_idx,
            format,
            info,
            dur_ticks,
            last_pts_ticks: -1,
        })
    }
}

/// Max forward gap (100 ns ticks) decoded by reading ahead instead of seeking. Reading ahead from
/// the current position is cheaper than seeking back to a keyframe and decoding forward again.
#[cfg(target_os = "windows")]
const READ_AHEAD_MAX_TICKS: i64 = 20_000_000; // 2.0 s
/// A decoded frame counts as "at" the target when within ~half a 15 fps bucket.
#[cfg(target_os = "windows")]
const FRAME_MATCH_TOLERANCE_TICKS: i64 = 350_000; // 35 ms
/// Safety cap on samples read for one request (covers keyframe intervals up to ~10 s at 60 fps).
#[cfg(target_os = "windows")]
const MAX_SAMPLES_PER_REQUEST: usize = 600;

/// Reads the next video sample. Refreshes the session's format when the decoder reports a
/// media type change (H.264 often reports its real frame size / aperture on the first sample).
#[cfg(target_os = "windows")]
unsafe fn read_next_sample(
    session: &mut MfVideoSession,
) -> Option<(
    u32,
    i64,
    Option<windows::Win32::Media::MediaFoundation::IMFSample>,
)> {
    use windows::Win32::Media::MediaFoundation::MF_SOURCE_READERF_CURRENTMEDIATYPECHANGED;

    unsafe {
        let mut flags: u32 = 0;
        let mut pts: i64 = 0;
        let mut sample = None;
        session
            .reader
            .ReadSample(
                session.stream_idx,
                0,
                None,
                Some(&mut flags),
                Some(&mut pts),
                Some(&mut sample),
            )
            .ok()?;
        if flags & (MF_SOURCE_READERF_CURRENTMEDIATYPECHANGED.0 as u32) != 0
            && let Some(info) =
                read_video_format(&session.reader, session.stream_idx, session.format)
        {
            session.info = info;
        }
        Some((flags, pts, sample))
    }
}

/// Converts the visible NV12 picture to downscaled BGRA (nearest-neighbour sampling).
/// `y_plane` / `pitch` describe the luma plane; the interleaved UV plane follows after
/// `buffer_height` rows.
#[cfg(target_os = "windows")]
unsafe fn convert_nv12_to_bgra(
    y_plane: *const u8,
    pitch: isize,
    buffer_height: usize,
    c: &YuvCoeffs,
    xs: &[usize],
    ys: &[usize],
    dst: &mut [u8],
) {
    let clamp = |v: i32| v.clamp(0, 255) as u8;
    let out_w = xs.len();
    unsafe {
        let uv_plane = y_plane.offset(pitch * buffer_height as isize);
        for (oy, &sy) in ys.iter().enumerate() {
            let y_row = y_plane.offset(sy as isize * pitch);
            let uv_row = uv_plane.offset((sy / 2) as isize * pitch);
            let dst_row = &mut dst[oy * out_w * 4..(oy + 1) * out_w * 4];
            for (ox, &sx) in xs.iter().enumerate() {
                let yv = (*y_row.add(sx) as i32 - c.y_off) * c.y;
                let uv = uv_row.add(sx & !1);
                let u = *uv as i32 - 128;
                let v = *uv.add(1) as i32 - 128;
                let d = &mut dst_row[ox * 4..ox * 4 + 4];
                d[0] = clamp((yv + c.bu * u + 32768) >> 16);
                d[1] = clamp((yv - c.gu * u - c.gv * v + 32768) >> 16);
                d[2] = clamp((yv + c.rv * v + 32768) >> 16);
                d[3] = 255;
            }
        }
    }
}

/// Copies the visible RGB32 (BGRX) picture to downscaled opaque BGRA.
#[cfg(target_os = "windows")]
unsafe fn copy_rgb32_to_bgra(
    scanline0: *const u8,
    pitch: isize,
    xs: &[usize],
    ys: &[usize],
    dst: &mut [u8],
) {
    let out_w = xs.len();
    unsafe {
        for (oy, &sy) in ys.iter().enumerate() {
            let row = scanline0.offset(sy as isize * pitch);
            let dst_row = &mut dst[oy * out_w * 4..(oy + 1) * out_w * 4];
            for (ox, &sx) in xs.iter().enumerate() {
                let p = row.add(sx * 4);
                let d = &mut dst_row[ox * 4..ox * 4 + 4];
                d[0] = *p;
                d[1] = *p.add(1);
                d[2] = *p.add(2);
                d[3] = 255; // Force opaque alpha for MFVideoFormat_RGB32 (BGRX)
            }
        }
    }
}

/// Decodes the frame at `req_ticks`. The returned flag is `true` when the frame is actually at the
/// target time; `false` means the reader stopped early (EOF / read error / sample cap) and the
/// frame must not be cached under the target bucket.
///
/// Fast keyframe scrubbing: after a seek, the first decoded frame (the keyframe the seek landed
/// on) is converted and handed to `on_seek_preview` right away, so the viewport moves within a
/// few ms instead of waiting 0.3–1 s for the decoder to reach the exact frame.
/// `is_superseded` is polled every few samples; when a newer position was requested for this
/// stream, decoding stops early and the newest decoded frame is returned (not reached).
#[cfg(target_os = "windows")]
fn decode_mf_video_frame(
    session: &mut MfVideoSession,
    req_ticks: i64,
    target_sec: f64,
    on_seek_preview: &mut dyn FnMut(DecodedVideoFrame),
    is_superseded: &dyn Fn() -> bool,
) -> Option<(DecodedVideoFrame, bool)> {
    use windows::{
        Win32::{
            Media::MediaFoundation::{
                IMFSample, MF_SOURCE_READERF_ENDOFSTREAM, MF_SOURCE_READERF_ERROR,
            },
            System::Com::StructuredStorage::PROPVARIANT,
        },
        core::GUID,
    };

    unsafe fn seek_reader(session: &MfVideoSession, ticks: i64) {
        unsafe {
            let mut prop: PROPVARIANT = std::mem::zeroed();
            let base = &mut prop as *mut _ as *mut u8;
            *(base as *mut u16) = 20u16; // VT_I8
            *(base.add(8) as *mut i64) = ticks;
            let _ = session.reader.SetCurrentPosition(&GUID::zeroed(), &prop);
        }
    }

    unsafe {
        // Seek only when going backward past the last decoded frame or jumping far ahead.
        // `SetCurrentPosition` lands on the preceding keyframe, so after a seek we must keep
        // decoding forward until we actually reach `req_ticks`.
        let needs_seek = session.last_pts_ticks < 0
            || req_ticks + FRAME_MATCH_TOLERANCE_TICKS < session.last_pts_ticks
            || (req_ticks - session.last_pts_ticks) > READ_AHEAD_MAX_TICKS;

        if needs_seek {
            seek_reader(session, req_ticks);
        }

        // Skipped samples are only decoded, never converted; that conversion is the costly part.
        let mut chosen_sample: Option<IMFSample> = None;
        let mut reached_target = false;
        let mut preview_pending = needs_seek;
        for i in 0..MAX_SAMPLES_PER_REQUEST {
            let Some((flags, pts, sample)) = read_next_sample(session) else {
                break;
            };
            if let Some(s) = sample {
                session.last_pts_ticks = pts;
                if pts + FRAME_MATCH_TOLERANCE_TICKS >= req_ticks {
                    chosen_sample = Some(s);
                    reached_target = true;
                    break;
                }
                if preview_pending {
                    // Target is still ahead: show the keyframe now, keep decoding to the target.
                    preview_pending = false;
                    if let Some(frame) = convert_sample_to_frame(session, &s, pts as f64 / 1e7) {
                        on_seek_preview(frame);
                    }
                }
                chosen_sample = Some(s);
            }
            if flags & (MF_SOURCE_READERF_ERROR.0 | MF_SOURCE_READERF_ENDOFSTREAM.0) as u32 != 0 {
                // Error or end of stream: the last frame is the closest we can get.
                reached_target = chosen_sample.is_some();
                break;
            }
            if i % 8 == 7 && is_superseded() {
                // The user already moved on (fast scrubbing). Stop here; the next job reads
                // ahead from this position or seeks and shows its own keyframe.
                break;
            }
        }

        // If seeking right to the very end hit EOF immediately, step back 0.25s and read a frame
        if chosen_sample.is_none() {
            seek_reader(session, (req_ticks - 2_500_000).max(0));
            if let Some((_, pts, Some(s))) = read_next_sample(session) {
                session.last_pts_ticks = pts;
                chosen_sample = Some(s);
                // Target is past the last frame: the final frame is the correct one to show.
                reached_target = true;
            }
        }

        let sample = chosen_sample?;
        let frame = convert_sample_to_frame(session, &sample, target_sec)?;
        Some((frame, reached_target))
    }
}

/// Converts one decoded sample to a downscaled BGRA preview frame.
#[cfg(target_os = "windows")]
unsafe fn convert_sample_to_frame(
    session: &MfVideoSession,
    sample: &windows::Win32::Media::MediaFoundation::IMFSample,
    target_sec: f64,
) -> Option<DecodedVideoFrame> {
    use windows::{Win32::Media::MediaFoundation::IMF2DBuffer, core::Interface};

    unsafe {
        let buffer = sample.ConvertToContiguousBuffer().ok()?;

        let info = session.info;
        let crop_w = info.crop_w as usize;
        let crop_h = info.crop_h as usize;
        let out_h = crop_h.clamp(1, MAX_PREVIEW_HEIGHT);
        let out_w = ((crop_w * out_h) / crop_h).max(1);
        let xs: Vec<usize> = (0..out_w)
            .map(|ox| info.crop_x as usize + (ox * crop_w) / out_w)
            .collect();
        let ys: Vec<usize> = (0..out_h)
            .map(|oy| info.crop_y as usize + (oy * crop_h) / out_h)
            .collect();
        let mut bgra_bytes = vec![0u8; out_w * out_h * 4];

        let buf2d = buffer.cast::<IMF2DBuffer>().ok();
        let (scanline0, pitch): (*const u8, isize) = if let Some(b) = &buf2d {
            let mut p: *mut u8 = std::ptr::null_mut();
            let mut pitch: i32 = 0;
            b.Lock2D(&mut p, &mut pitch).ok()?;
            (p as *const u8, pitch as isize)
        } else {
            let mut raw: *mut u8 = std::ptr::null_mut();
            let mut len: u32 = 0;
            buffer.Lock(&mut raw, None, Some(&mut len)).ok()?;
            let bytes_per_px = if session.format == PixelFormat::Nv12 {
                1
            } else {
                4
            };
            let stride = if info.default_stride != 0 {
                info.default_stride as isize
            } else {
                (info.width as usize * bytes_per_px) as isize
            };
            let rows = match session.format {
                PixelFormat::Nv12 => info.height as usize * 3 / 2,
                PixelFormat::Rgb32 => info.height as usize,
            };
            if raw.is_null() || (len as usize) < stride.unsigned_abs() * rows {
                let _ = buffer.Unlock();
                return None;
            }
            let s0 = if stride < 0 {
                raw.add((info.height as usize - 1) * stride.unsigned_abs())
            } else {
                raw
            };
            (s0 as *const u8, stride)
        };

        let valid = !scanline0.is_null() && pitch != 0;
        if valid {
            match session.format {
                PixelFormat::Nv12 => convert_nv12_to_bgra(
                    scanline0,
                    pitch,
                    info.height as usize,
                    &info.coeffs,
                    &xs,
                    &ys,
                    &mut bgra_bytes,
                ),
                PixelFormat::Rgb32 => {
                    copy_rgb32_to_bgra(scanline0, pitch, &xs, &ys, &mut bgra_bytes)
                }
            }
        }
        match &buf2d {
            Some(b) => {
                let _ = b.Unlock2D();
            }
            None => {
                let _ = buffer.Unlock();
            }
        }
        if !valid {
            return None;
        }

        Some(DecodedVideoFrame {
            width: out_w as u32,
            height: out_h as u32,
            timestamp_sec: target_sec,
            bgra_bytes,
        })
    }
}

#[cfg(target_os = "windows")]
fn decoder_worker_loop(svc: Arc<DecoderService>) {
    use windows::Win32::{
        Media::MediaFoundation::{MF_API_VERSION, MFSTARTUP_NOSOCKET, MFStartup},
        System::Com::{COINIT_MULTITHREADED, CoInitializeEx},
    };

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let _ = MFStartup(MF_API_VERSION, MFSTARTUP_NOSOCKET);
    }

    // One reader per (path, stream) so each clip keeps its own sequential read position.
    // The `Instant` is the last time the session decoded a frame.
    let mut sessions: HashMap<(String, String), (MfVideoSession, std::time::Instant)> =
        HashMap::new();

    loop {
        let job = {
            let mut guard = svc.state.lock().unwrap();
            loop {
                if let Some(job) = guard.pending_jobs.pop_front() {
                    guard.in_flight = Some(job.clone());
                    break Some(job);
                }
                if sessions.is_empty() {
                    guard = svc.job_cvar.wait(guard).unwrap();
                } else {
                    // Wake periodically so idle sessions can be closed.
                    let (g, res) = svc
                        .job_cvar
                        .wait_timeout(guard, Duration::from_secs(5))
                        .unwrap();
                    guard = g;
                    if res.timed_out() && guard.pending_jobs.is_empty() {
                        break None;
                    }
                }
            }
        };

        // Close readers (and their decoders' frame buffers) that haven't been used recently.
        sessions.retain(|_, (_, last_used)| last_used.elapsed() < SESSION_IDLE_TIMEOUT);

        let Some(job) = job else {
            continue;
        };

        process_decode_job(&svc, &mut sessions, &job);
        svc.state.lock().unwrap().in_flight = None;
    }
}

#[cfg(target_os = "windows")]
fn process_decode_job(
    svc: &Arc<DecoderService>,
    sessions: &mut HashMap<(String, String), (MfVideoSession, std::time::Instant)>,
    job: &DecodeJob,
) {
    // Another stream may already have decoded this exact frame.
    if job.stream != THUMBNAIL_STREAM {
        let mut guard = svc.state.lock().unwrap();
        if let Some(cached) = guard.frames.get(&(job.path.clone(), job.bucket)).cloned() {
            guard
                .latest_by_stream
                .insert((job.path.clone(), job.stream.clone()), cached);
            svc.result_cvar.notify_all();
            return;
        }
    }

    let session_key = (job.path.clone(), job.stream.clone());
    if !sessions.contains_key(&session_key) {
        match open_mf_video_session(&job.path) {
            Some(session) => {
                if sessions.len() >= MAX_OPEN_SESSIONS
                    && let Some(oldest) = sessions
                        .iter()
                        .min_by_key(|(_, (_, used))| *used)
                        .map(|(k, _)| k.clone())
                {
                    sessions.remove(&oldest);
                }
                sessions.insert(session_key.clone(), (session, std::time::Instant::now()));
            }
            None => {
                let mut guard = svc.state.lock().unwrap();
                guard.failed_sources.insert(job.path.clone(), true);
                svc.result_cvar.notify_all();
                return;
            }
        }
    }

    let Some((session, last_used)) = sessions.get_mut(&session_key) else {
        return;
    };
    *last_used = std::time::Instant::now();

    let target_sec = (job.bucket as f64) / BUCKET_FPS;
    let max_ticks = (session.dur_ticks - 300_000).max(0);
    let req_ticks = ((target_sec * 10_000_000.0) as i64).clamp(0, max_ticks);

    let is_playback_stream = job.stream != THUMBNAIL_STREAM;
    let mut on_seek_preview = |frame: DecodedVideoFrame| {
        if !is_playback_stream {
            return;
        }
        // Show as progress only; never cache a keyframe under the target bucket.
        svc.state
            .lock()
            .unwrap()
            .latest_by_stream
            .insert((job.path.clone(), job.stream.clone()), Arc::new(frame));
        FRAME_GENERATION.fetch_add(1, Ordering::Release);
        svc.result_cvar.notify_all();
    };
    // Only a request for a *different* position counts; the same frame asked for again by a
    // repaint must not cancel the decode that is producing it.
    let is_superseded = || {
        is_playback_stream
            && svc
                .state
                .lock()
                .unwrap()
                .pending_jobs
                .iter()
                .any(|j| j.path == job.path && j.stream == job.stream && j.bucket != job.bucket)
    };
    let decoded = decode_mf_video_frame(
        session,
        req_ticks,
        target_sec,
        &mut on_seek_preview,
        &is_superseded,
    );

    // Thumbnail readers are one-shot; release them right away.
    if job.stream == THUMBNAIL_STREAM {
        sessions.remove(&session_key);
    }

    let mut guard = svc.state.lock().unwrap();
    match decoded {
        // Thumbnails keep whatever frame they got.
        Some((frame, reached)) if reached || !is_playback_stream => {
            guard.insert_frame(job, Arc::new(frame))
        }
        // Stopped short of the target: show it as progress, but never cache it under the
        // target bucket (a wrong frame cached there would replay as a frozen image).
        Some((frame, _)) => {
            guard
                .latest_by_stream
                .insert((job.path.clone(), job.stream.clone()), Arc::new(frame));
        }
        None if !is_playback_stream => {
            guard.failed_sources.insert(job.path.clone(), true);
        }
        None => {}
    }
    FRAME_GENERATION.fetch_add(1, Ordering::Release);
    svc.result_cvar.notify_all();
}

#[cfg(not(target_os = "windows"))]
fn decoder_worker_loop(_svc: Arc<DecoderService>) {}

/// Requests a decoded BGRA video frame for one independent decode stream (usually a timeline clip id).
///
/// Called from the GPUI render path, so it must stay cheap:
/// * Once the stream has any frame, it never blocks (playing or paused). It queues the newest
///   position and returns the cached exact frame or the latest available one, raising the stale
///   flag (see [`take_stale_frame_flag`]) so the UI repaints when decoding finishes.
/// * The first frame of a stream waits briefly (40 ms playing, 150 ms paused) to avoid a blank viewport.
pub fn request_video_frame_for_stream(
    source_path: &str,
    stream: &str,
    source_timestamp_sec: f64,
    is_playing: bool,
) -> Option<Arc<DecodedVideoFrame>> {
    let clean_path = normalize_media_path(source_path)?;
    let bucket = (source_timestamp_sec.max(0.0) * BUCKET_FPS).round() as i64;
    let key = (clean_path.clone(), bucket);
    let stream_key = (clean_path.clone(), stream.to_string());

    let svc = get_decoder_service();
    let mut guard = svc.state.lock().unwrap();

    if let Some(cached) = guard.frames.get(&key).cloned() {
        guard.latest_by_stream.insert(stream_key, cached.clone());
        return Some(cached);
    }
    if guard.failed_sources.contains_key(&clean_path) {
        return None;
    }

    let job = DecodeJob {
        path: clean_path.clone(),
        stream: stream.to_string(),
        bucket,
    };
    if guard.in_flight.as_ref() == Some(&job) {
        // Already being decoded: don't queue a duplicate (it would restart the decode from
        // the keyframe after this one finishes or is cut short).
    } else {
        guard.enqueue(job);
        svc.job_cvar.notify_one();
    }

    let has_stream_frame = guard.latest_by_stream.contains_key(&stream_key);
    // Never block once the stream has something to show: this runs on the GPUI thread for every
    // video surface on every repaint, and scrubbing repaints on each mouse move. Waiting here
    // made the playhead lag behind the cursor. The stale-frame flag below triggers a repaint
    // as soon as the exact frame is decoded.
    let wait = Duration::from_millis(match (has_stream_frame, is_playing) {
        (true, _) => 0,
        (false, true) => 40,
        (false, false) => 150,
    });

    // `result_cvar` wakes for every finished job, so loop until our frame lands or time runs out.
    let deadline = std::time::Instant::now() + wait;
    loop {
        if let Some(exact) = guard.frames.get(&key) {
            return Some(exact.clone());
        }
        if guard.failed_sources.contains_key(&clean_path) {
            return None;
        }
        let now = std::time::Instant::now();
        if now >= deadline {
            break;
        }
        guard = svc
            .result_cvar
            .wait_timeout(guard, deadline - now)
            .unwrap()
            .0;
    }
    STALE_FRAME_SERVED.store(true, Ordering::Release);
    guard.latest_by_stream.get(&stream_key).cloned()
}

/// Returns the pinned first-frame thumbnail for a video file, decoding it on a one-shot reader
/// the first time. Thumbnails live outside the playback LRU, so rendering the Media Bin
/// never evicts, cancels, or seeks timeline playback streams.
pub fn request_video_thumbnail(source_path: &str) -> Option<Arc<DecodedVideoFrame>> {
    let clean_path = normalize_media_path(source_path)?;
    let svc = get_decoder_service();
    let mut guard = svc.state.lock().unwrap();

    if let Some(thumb) = guard.thumbnails.get(&clean_path) {
        return Some(thumb.clone());
    }
    if guard.failed_sources.contains_key(&clean_path) {
        return None;
    }
    let already_pending = guard
        .pending_jobs
        .iter()
        .any(|j| j.path == clean_path && j.stream == THUMBNAIL_STREAM);
    if already_pending {
        STALE_FRAME_SERVED.store(true, Ordering::Release);
        return None;
    }

    guard.enqueue(DecodeJob {
        path: clean_path.clone(),
        stream: THUMBNAIL_STREAM.to_string(),
        bucket: 0,
    });
    svc.job_cvar.notify_one();

    let deadline = std::time::Instant::now() + Duration::from_millis(450);
    loop {
        if let Some(thumb) = guard.thumbnails.get(&clean_path) {
            return Some(thumb.clone());
        }
        if guard.failed_sources.contains_key(&clean_path) {
            return None;
        }
        let now = std::time::Instant::now();
        if now >= deadline {
            STALE_FRAME_SERVED.store(true, Ordering::Release);
            return None;
        }
        guard = svc
            .result_cvar
            .wait_timeout(guard, deadline - now)
            .unwrap()
            .0;
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    fn request_video_frame(path: &str, t: f64, is_playing: bool) -> Option<Arc<DecodedVideoFrame>> {
        request_video_frame_for_stream(path, "test", t, is_playing)
    }

    /// Generates a minimal valid uncompressed RGB24 RIFF AVI video file for testing `IMFSourceReader`.
    fn write_test_avi(path: &std::path::Path, width: u32, height: u32, num_frames: u32) {
        let frame_bytes = (width * height * 3) as usize;
        let movi_data_size = num_frames as usize * (8 + frame_bytes);
        let movi_list_size = 4 + movi_data_size;
        let hdrl_list_size = 4 + (8 + 56) + (12 + (8 + 56) + (8 + 40));
        let riff_size = 4 + (8 + hdrl_list_size) + (8 + movi_list_size);

        let mut buf = Vec::with_capacity(riff_size + 8);
        let push_u32 = |b: &mut Vec<u8>, v: u32| b.extend_from_slice(&v.to_le_bytes());
        let push_u16 = |b: &mut Vec<u8>, v: u16| b.extend_from_slice(&v.to_le_bytes());

        buf.extend_from_slice(b"RIFF");
        push_u32(&mut buf, riff_size as u32);
        buf.extend_from_slice(b"AVI ");

        // LIST hdrl
        buf.extend_from_slice(b"LIST");
        push_u32(&mut buf, hdrl_list_size as u32);
        buf.extend_from_slice(b"hdrl");

        // avih (56 bytes)
        buf.extend_from_slice(b"avih");
        push_u32(&mut buf, 56);
        push_u32(&mut buf, 100_000); // dwMicroSecPerFrame (10 fps)
        push_u32(&mut buf, (frame_bytes * 10) as u32); // dwMaxBytesPerSec
        push_u32(&mut buf, 0); // dwPaddingGranularity
        push_u32(&mut buf, 0x10); // dwFlags
        push_u32(&mut buf, num_frames); // dwTotalFrames
        push_u32(&mut buf, 0); // dwInitialFrames
        push_u32(&mut buf, 1); // dwStreams
        push_u32(&mut buf, frame_bytes as u32); // dwSuggestedBufferSize
        push_u32(&mut buf, width);
        push_u32(&mut buf, height);
        for _ in 0..4 {
            push_u32(&mut buf, 0);
        }

        // LIST strl
        let strl_size = 4 + (8 + 56) + (8 + 40);
        buf.extend_from_slice(b"LIST");
        push_u32(&mut buf, strl_size as u32);
        buf.extend_from_slice(b"strl");

        // strh (56 bytes)
        buf.extend_from_slice(b"strh");
        push_u32(&mut buf, 56);
        buf.extend_from_slice(b"vids");
        buf.extend_from_slice(b"\0\0\0\0"); // BI_RGB
        push_u32(&mut buf, 0); // dwFlags
        push_u16(&mut buf, 0); // wPriority
        push_u16(&mut buf, 0); // wLanguage
        push_u32(&mut buf, 0); // dwInitialFrames
        push_u32(&mut buf, 1); // dwScale
        push_u32(&mut buf, 10); // dwRate (10 fps)
        push_u32(&mut buf, 0); // dwStart
        push_u32(&mut buf, num_frames); // dwLength
        push_u32(&mut buf, frame_bytes as u32); // dwSuggestedBufferSize
        push_u32(&mut buf, u32::MAX); // dwQuality
        push_u32(&mut buf, 0); // dwSampleSize
        push_u16(&mut buf, 0); // rcFrame.left
        push_u16(&mut buf, 0); // rcFrame.top
        push_u16(&mut buf, width as u16); // rcFrame.right
        push_u16(&mut buf, height as u16); // rcFrame.bottom

        // strf (BITMAPINFOHEADER = 40 bytes)
        buf.extend_from_slice(b"strf");
        push_u32(&mut buf, 40);
        push_u32(&mut buf, 40); // biSize
        push_u32(&mut buf, width); // biWidth
        push_u32(&mut buf, height); // biHeight
        push_u16(&mut buf, 1); // biPlanes
        push_u16(&mut buf, 24); // biBitCount (RGB24)
        push_u32(&mut buf, 0); // biCompression (BI_RGB)
        push_u32(&mut buf, frame_bytes as u32); // biSizeImage
        push_u32(&mut buf, 0);
        push_u32(&mut buf, 0);
        push_u32(&mut buf, 0);
        push_u32(&mut buf, 0);

        // LIST movi
        buf.extend_from_slice(b"LIST");
        push_u32(&mut buf, movi_list_size as u32);
        buf.extend_from_slice(b"movi");

        for f in 0..num_frames {
            buf.extend_from_slice(b"00db");
            push_u32(&mut buf, frame_bytes as u32);
            for _ in 0..(width * height) {
                buf.push(40 + (f as u8) * 20); // B
                buf.push(120); // G
                buf.push(210); // R
            }
        }

        std::fs::write(path, &buf).expect("write test avi");
    }

    #[test]
    fn test_mf_source_reader_video_frame_decode_and_probe() {
        let tmp_path = std::env::temp_dir().join("predit_mf_test_video.avi");
        write_test_avi(&tmp_path, 64, 48, 10);
        let path_str = tmp_path.to_string_lossy().to_string();

        let dur = crate::probe::probe_media_duration(&path_str)
            .expect("should probe AVI duration via IMFSourceReader");
        assert!(
            (dur - 1.0).abs() < 0.2,
            "expected ~1.0s duration, got {dur}"
        );

        // The first request waits at most 150 ms; Media Foundation's first startup in a fresh
        // process can take longer, so poll (the app repaints via the stale-frame flag instead).
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        let frame0 = loop {
            if let Some(f) = request_video_frame(&path_str, 0.0, false) {
                break f;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "should decode initial video frame at 0.0s"
            );
            std::thread::sleep(Duration::from_millis(10));
        };
        assert_eq!(frame0.width, 64);
        assert_eq!(frame0.height, 48);
        assert_eq!(frame0.bgra_bytes.len(), 64 * 48 * 4);
        assert_eq!(frame0.bgra_bytes[3], 255, "alpha must be opaque (255)");
        assert!(
            frame0.bgra_bytes[2] > 180,
            "red channel should match test frame"
        );

        // During playback requests never block once a stream has a frame: the first call
        // returns the previous frame immediately while the worker decodes 0.8s in the background.
        let started = std::time::Instant::now();
        let immediate = request_video_frame(&path_str, 0.8, true)
            .expect("playback request should return the latest available frame");
        assert!(
            started.elapsed() < Duration::from_millis(30),
            "playback frame request must not block the UI thread"
        );
        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        let mut frame_late = immediate;
        while (frame_late.timestamp_sec - 0.8).abs() > 0.04 {
            assert!(
                std::time::Instant::now() < deadline,
                "0.8s frame was never decoded"
            );
            std::thread::sleep(Duration::from_millis(10));
            frame_late = request_video_frame(&path_str, 0.8, true)
                .expect("should decode video frame at 0.8s during playback");
        }
        assert!(
            frame_late.bgra_bytes[0] > frame0.bgra_bytes[0],
            "blue channel at 0.8s ({}) should be brighter than at 0.0s ({})",
            frame_late.bgra_bytes[0],
            frame0.bgra_bytes[0]
        );

        // Paused requests don't block either (scrubbing must keep up with the cursor):
        // poll until the worker delivers the 0.1s frame.
        let started = std::time::Instant::now();
        let mut frame_seek_back = request_video_frame(&path_str, 0.1, false)
            .expect("paused request should return the latest available frame");
        assert!(
            started.elapsed() < Duration::from_millis(30),
            "paused frame request must not block the UI thread while scrubbing"
        );
        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        while (frame_seek_back.timestamp_sec - 0.1).abs() > 0.04 {
            assert!(
                std::time::Instant::now() < deadline,
                "0.1s frame was never decoded"
            );
            std::thread::sleep(Duration::from_millis(10));
            frame_seek_back = request_video_frame(&path_str, 0.1, false)
                .expect("should decode frame when seeking backward to 0.1s");
        }
        assert!(
            frame_seek_back.bgra_bytes[0] < frame_late.bgra_bytes[0],
            "seeking back to 0.1s ({}) should decode earlier frame than 0.8s ({})",
            frame_seek_back.bgra_bytes[0],
            frame_late.bgra_bytes[0]
        );

        let _ = std::fs::remove_file(&tmp_path);
    }
}
