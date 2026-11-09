use crate::primitives::timecode_input::format_timecode;
use crate::theme::CapCutTheme;
use editor_core::models::{MediaKind, VideoClip};
use gpui::{
    IntoElement, ObjectFit, RenderImage, SharedString, StyledImage, div, img, prelude::*, px, rgb,
    rgba,
};
use media_engine::decoder::{
    DecodedVideoFrame, request_video_frame_for_stream, request_video_thumbnail,
};
use media_engine::probe::IMAGE_EXTENSIONS;
use media_engine::text_renderer::PositionedSubtitleLayer;
use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};

/// Each `RenderImage` keeps its own CPU copy of the pixels (~1.5 MB for 1080p landscape preview)
/// on top of the GPU atlas copy. Playback only redraws the current frame of each visible clip,
/// so a few textures per stream is enough; older frames are re-uploaded from the decoder cache.
const MAX_RENDER_TEXTURES: usize = 12;

fn frame_to_render_image(frame: &DecodedVideoFrame) -> Option<Arc<RenderImage>> {
    let img_buf = image::ImageBuffer::<image::Rgba<u8>, Vec<u8>>::from_raw(
        frame.width,
        frame.height,
        frame.bgra_bytes.clone(),
    )?;
    Some(Arc::new(RenderImage::new(smallvec::smallvec![
        image::Frame::new(img_buf)
    ])))
}

struct RenderTextureCache {
    map: HashMap<(String, i64), Arc<RenderImage>>,
    order: VecDeque<(String, i64)>,
    /// Pinned Media Bin thumbnails, keyed by source path (never evicted by playback).
    thumbnails: HashMap<String, Arc<RenderImage>>,
    /// Textures evicted from `map` that still occupy GPUI's sprite atlas.
    /// GPUI only frees atlas memory via `drop_image`, so the workspace drains these each frame.
    evicted: Vec<Arc<RenderImage>>,
}

impl RenderTextureCache {
    fn new() -> Self {
        Self {
            map: HashMap::new(),
            order: VecDeque::new(),
            thumbnails: HashMap::new(),
            evicted: Vec::new(),
        }
    }

    fn get_or_insert(
        &mut self,
        source_file: &str,
        frame: &DecodedVideoFrame,
    ) -> Option<Arc<RenderImage>> {
        let key = (
            source_file.to_string(),
            (frame.timestamp_sec * 1000.0).round() as i64,
        );
        if let Some(existing) = self.map.get(&key) {
            return Some(existing.clone());
        }

        let render_img = frame_to_render_image(frame)?;

        self.order.push_back(key.clone());
        while self.order.len() > MAX_RENDER_TEXTURES {
            if let Some(old_key) = self.order.pop_front()
                && let Some(old_img) = self.map.remove(&old_key)
            {
                self.evicted.push(old_img);
            }
        }
        self.map.insert(key, render_img.clone());
        Some(render_img)
    }
}

static RENDER_TEXTURE_CACHE: OnceLock<Mutex<RenderTextureCache>> = OnceLock::new();

fn texture_cache() -> &'static Mutex<RenderTextureCache> {
    RENDER_TEXTURE_CACHE.get_or_init(|| Mutex::new(RenderTextureCache::new()))
}

/// Resolves a GPU texture for `source_file` at `source_time` on decode stream `stream`
/// (use the timeline clip id so clips sharing a file decode independently).
pub fn resolve_file_render_image(
    source_file: &str,
    stream: &str,
    source_time: f64,
    is_playing: bool,
) -> Option<Arc<RenderImage>> {
    let decoded = request_video_frame_for_stream(source_file, stream, source_time, is_playing)?;
    texture_cache()
        .lock()
        .unwrap()
        .get_or_insert(source_file, &decoded)
}

/// Resolves the pinned first-frame thumbnail texture used by Media Bin cards.
pub fn resolve_thumbnail_render_image(source_file: &str) -> Option<Arc<RenderImage>> {
    if let Some(tex) = texture_cache().lock().unwrap().thumbnails.get(source_file) {
        return Some(tex.clone());
    }
    let decoded = request_video_thumbnail(source_file)?;
    let tex = frame_to_render_image(&decoded)?;
    texture_cache()
        .lock()
        .unwrap()
        .thumbnails
        .insert(source_file.to_string(), tex.clone());
    Some(tex)
}

/// Takes video textures that were evicted from the cache. The caller must pass each one to
/// `App::drop_image` so GPUI releases its sprite-atlas memory; otherwise every decoded
/// playback frame stays resident on the GPU.
pub fn drain_evicted_render_images() -> Vec<Arc<RenderImage>> {
    std::mem::take(&mut texture_cache().lock().unwrap().evicted)
}

fn resolve_video_render_image(
    clip: &VideoClip,
    playhead: f64,
    is_playing: bool,
) -> Option<Arc<RenderImage>> {
    let clip_offset = (playhead - clip.start_time).max(0.0);
    let rate = clip.playback_rate.max(0.05);
    let source_time = (clip.source_start + clip_offset * rate)
        .clamp(clip.source_start, clip.source_end.max(clip.source_start));

    resolve_file_render_image(&clip.source_file, &clip.id, source_time, is_playing)
}

pub fn render_video_surface(
    playhead: f64,
    is_playing: bool,
    active_video: Option<&VideoClip>,
    active_overlays: &[VideoClip],
    subtitle_layers: &[PositionedSubtitleLayer],
    selected_clip_id: Option<&str>,
    stage_width: f32,
    stage_height: f32,
) -> impl IntoElement {
    let has_active_video = active_video.is_some();

    div()
        .relative()
        .w(px(stage_width))
        .h(px(stage_height))
        .overflow_hidden()
        .bg(rgb(0x0e0e10))
        .rounded(px(4.0))
        .border_1()
        .border_color(rgb(0x27272a))
        .flex()
        .items_center()
        .justify_center()
        // 1. Center Main Video/Image Frame
        .when(has_active_video, |this| {
            let v = active_video.unwrap();
            let filename = Path::new(&v.source_file)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&v.source_file)
                .to_string();

            let ext = Path::new(&v.source_file)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            let is_image =
                v.media_kind == MediaKind::Image || IMAGE_EXTENSIONS.contains(&ext.as_str());
            let file_exists = Path::new(&v.source_file).exists();

            let clip_len = (v.end_time - v.start_time).max(0.001);
            let rel_time = (playhead - v.start_time).clamp(0.0, clip_len);
            let progress = (rel_time / clip_len).clamp(0.0, 1.0) as f32;
            let fill_width = (stage_width * progress).round().max(2.0);

            if is_image && file_exists {
                this.child(
                    div()
                        .relative()
                        .w_full()
                        .h_full()
                        .flex()
                        .items_center()
                        .justify_center()
                        .overflow_hidden()
                        .child(
                            img(Path::new(&v.source_file).to_path_buf())
                                .w_full()
                                .h_full()
                                .object_fit(ObjectFit::Contain),
                        )
                        .child(
                            div()
                                .absolute()
                                .bottom(px(0.0))
                                .left(px(0.0))
                                .w_full()
                                .h(px(3.0))
                                .bg(rgba(0x27272a80))
                                .child(div().h_full().w(px(fill_width)).bg(CapCutTheme::accent())),
                        ),
                )
            } else if let Some(decoded_texture) =
                resolve_video_render_image(v, playhead, is_playing)
            {
                // Real decoded video frame rendered directly onto the GPU surface
                this.child(
                    div()
                        .relative()
                        .w_full()
                        .h_full()
                        .flex()
                        .items_center()
                        .justify_center()
                        .overflow_hidden()
                        .bg(rgb(0x000000))
                        .child(
                            img(decoded_texture)
                                .w_full()
                                .h_full()
                                .object_fit(ObjectFit::Contain),
                        )
                        // Subtle bottom playback progress bar
                        .child(
                            div()
                                .absolute()
                                .bottom(px(0.0))
                                .left(px(0.0))
                                .w_full()
                                .h(px(3.0))
                                .bg(rgba(0x27272a80))
                                .child(div().h_full().w(px(fill_width)).bg(CapCutTheme::accent())),
                        ),
                )
            } else {
                // Fallback viewport when path does not exist on disk (e.g. unit test mock paths)
                this.child(
                    div()
                        .relative()
                        .w_full()
                        .h_full()
                        .bg(rgb(0x121215))
                        .flex()
                        .flex_col()
                        .justify_between()
                        .overflow_hidden()
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .justify_between()
                                .px_3()
                                .pt_2p5()
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_2()
                                        .child(
                                            div()
                                                .px_1p5()
                                                .py_0p5()
                                                .rounded(px(3.0))
                                                .bg(rgba(0x00c8d226))
                                                .border_1()
                                                .border_color(CapCutTheme::accent())
                                                .text_xs()
                                                .text_color(CapCutTheme::accent())
                                                .child("V1 • Main Video"),
                                        )
                                        .child(
                                            div()
                                                .text_xs()
                                                .text_color(rgb(0xe4e4e7))
                                                .child(SharedString::from(filename.clone())),
                                        ),
                                )
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_1p5()
                                        .px_2()
                                        .py_0p5()
                                        .rounded(px(3.0))
                                        .bg(if is_playing {
                                            rgba(0x22c55e22)
                                        } else {
                                            rgba(0x27272acc)
                                        })
                                        .border_1()
                                        .border_color(if is_playing {
                                            rgb(0x22c55e)
                                        } else {
                                            rgb(0x3f3f46)
                                        })
                                        .child(div().w(px(6.0)).h(px(6.0)).rounded_full().bg(
                                            if is_playing {
                                                rgb(0x22c55e)
                                            } else {
                                                rgb(0x71717a)
                                            },
                                        ))
                                        .child(
                                            div()
                                                .text_xs()
                                                .text_color(if is_playing {
                                                    rgb(0x4ade80)
                                                } else {
                                                    rgb(0xa1a1aa)
                                                })
                                                .child(if is_playing {
                                                    "PLAYING"
                                                } else {
                                                    "PAUSED"
                                                }),
                                        ),
                                ),
                        )
                        .child(
                            div()
                                .flex_1()
                                .flex()
                                .flex_col()
                                .items_center()
                                .justify_center()
                                .gap_2()
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_2()
                                        .child(div().text_sm().text_color(rgb(0xffffff)).child(
                                            SharedString::from(format_timecode(rel_time, 30)),
                                        ))
                                        .child(div().text_xs().text_color(rgb(0x71717a)).child(
                                            SharedString::from(format!(
                                                "/ {}",
                                                format_timecode(clip_len, 30)
                                            )),
                                        )),
                                ),
                        )
                        .child(
                            div()
                                .w_full()
                                .h(px(3.0))
                                .bg(rgb(0x27272a))
                                .child(div().h_full().w(px(fill_width)).bg(CapCutTheme::accent())),
                        ),
                )
            }
        })
        // 2. Empty stage placeholder when neither video nor overlays exist
        .when(!has_active_video && active_overlays.is_empty(), |this| {
            this.child(
                div()
                    .flex()
                    .flex_col()
                    .items_center()
                    .justify_center()
                    .gap_2()
                    .child(
                        div()
                            .w(px(48.0))
                            .h(px(48.0))
                            .rounded_full()
                            .bg(rgb(0x18181b))
                            .border_1()
                            .border_color(rgb(0x27272a))
                            .flex()
                            .items_center()
                            .justify_center()
                            .text_lg()
                            .text_color(rgb(0x71717a))
                            .child("🎬"),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(0x71717a))
                            .child("No media at playhead position"),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(0x52525b))
                            .child("Press Space to play • Drag media to timeline"),
                    ),
            )
        })
        // 3. Active PIP / Higher-Layer Video & Image Overlays rendered in track order (higher layer on top)
        .children(active_overlays.iter().rev().map(|ov| {
            let pos = ov
                .position
                .unwrap_or(editor_core::models::Point2D { x: 0.5, y: 0.5 });
            let scale = ov.scale.unwrap_or(1.0) as f32;
            let ov_w = (stage_width * scale).clamp(48.0, stage_width);
            let ov_h = (stage_height * scale).clamp(36.0, stage_height);
            let left_px = ((pos.x as f32 * stage_width) - ov_w * 0.5)
                .clamp(0.0, (stage_width - ov_w).max(0.0));
            let top_px = ((pos.y as f32 * stage_height) - ov_h * 0.5)
                .clamp(0.0, (stage_height - ov_h).max(0.0));
            let is_sel = selected_clip_id == Some(ov.id.as_str());

            let ov_path = Path::new(&ov.source_file);
            let ov_ext = ov_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let is_ov_image =
                ov.media_kind == MediaKind::Image || IMAGE_EXTENSIONS.contains(&ov_ext.as_str());
            let ov_exists = ov_path.exists();

            let ov_video_texture = if !is_ov_image && ov_exists {
                resolve_video_render_image(ov, playhead, is_playing)
            } else {
                None
            };

            let has_ov_video_texture = ov_video_texture.is_some();

            let ov_len = (ov.end_time - ov.start_time).max(0.001);
            let ov_rel = (playhead - ov.start_time).clamp(0.0, ov_len);
            let ov_pct = (ov_rel / ov_len).clamp(0.0, 1.0) as f32;
            let ov_fill = (ov_w * ov_pct).round().max(1.0);

            let ov_fname = ov_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&ov.source_file)
                .to_string();

            div()
                .absolute()
                .left(px(left_px))
                .top(px(top_px))
                .w(px(ov_w))
                .h(px(ov_h))
                .rounded(px(4.0))
                .overflow_hidden()
                .bg(rgb(0x182428))
                .border_1()
                .border_color(if is_sel {
                    CapCutTheme::accent()
                } else {
                    rgb(0x1f4d4f)
                })
                .when(is_sel, |d| d.border_2().shadow_lg())
                .when(is_ov_image && ov_exists, |d| {
                    d.child(img(ov_path.to_path_buf()).w_full().h_full().object_fit(
                        if scale >= 0.95 {
                            ObjectFit::Contain
                        } else {
                            ObjectFit::Cover
                        },
                    ))
                })
                .when_some(ov_video_texture, |d, tex| {
                    d.child(img(tex).w_full().h_full().object_fit(if scale >= 0.95 {
                        ObjectFit::Contain
                    } else {
                        ObjectFit::Cover
                    }))
                })
                .when(!is_ov_image && !has_ov_video_texture, |d| {
                    d.flex()
                        .flex_col()
                        .justify_between()
                        .p_1p5()
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .justify_between()
                                .text_xs()
                                .child(
                                    div()
                                        .px_1()
                                        .rounded(px(2.0))
                                        .bg(rgba(0x00c8d233))
                                        .text_color(CapCutTheme::accent())
                                        .child("PIP"),
                                )
                                .child(
                                    div()
                                        .truncate()
                                        .max_w(px(ov_w - 40.0))
                                        .text_color(rgb(0xe4e4e7))
                                        .child(SharedString::from(ov_fname)),
                                ),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_color(CapCutTheme::accent())
                                .child("📹"),
                        )
                        .child(
                            div()
                                .w_full()
                                .h(px(2.0))
                                .bg(rgb(0x27272a))
                                .child(div().h_full().w(px(ov_fill)).bg(CapCutTheme::accent())),
                        )
                })
        }))
        // 4. Active Text / Title / Caption Overlays positioned at their normalized (x, y) coordinates
        .children(subtitle_layers.iter().map(|layer| {
            let is_selected = selected_clip_id == Some(layer.clip_id.as_str());
            let text_color = CapCutTheme::parse_hex(&layer.style.color, 1.0);
            let bg_box = &layer.style.background_box;
            let bg_color = if bg_box.enabled {
                CapCutTheme::parse_hex(&bg_box.color, bg_box.opacity as f32)
            } else {
                rgba(0x00000000)
            };
            let norm_y = (layer.style.position.y as f32).clamp(0.05, 0.92);
            let top_px = (norm_y * stage_height - 16.0).max(4.0);

            div()
                .absolute()
                .left(px(0.0))
                .right(px(0.0))
                .top(px(top_px))
                .flex()
                .justify_center()
                .child(
                    div()
                        .px_2p5()
                        .py_1()
                        .rounded(px(bg_box.border_radius as f32))
                        .bg(bg_color)
                        .when(is_selected, |d| d.border_1().border_color(rgba(0xffffff99)))
                        .text_base()
                        .text_color(text_color)
                        .child(SharedString::from(layer.text.clone())),
                )
        }))
}
