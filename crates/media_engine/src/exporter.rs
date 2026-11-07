use editor_core::config::HardwareAcceleration;
use editor_core::project::TimelineState;

#[derive(Debug, Clone)]
pub struct ExportCommandPlan {
    pub args: Vec<String>,
    pub command_preview: String,
}

pub fn resolve_hardware_encoder(hw: HardwareAcceleration) -> (&'static str, Vec<&'static str>) {
    match hw {
        HardwareAcceleration::Cpu => ("libx264", vec!["-preset", "veryfast", "-crf", "21"]),
        HardwareAcceleration::Videotoolbox => ("h264_videotoolbox", vec!["-q:v", "65"]),
        HardwareAcceleration::Auto | HardwareAcceleration::Nvenc => {
            ("h264_nvenc", vec!["-preset", "p4", "-cq", "21"])
        }
    }
}

pub fn build_chained_atempo(speed: f64) -> String {
    let clamped = speed.clamp(0.25, 4.0);
    if (clamped - 1.0).abs() < 0.01 {
        return "anull".into();
    }
    let mut filters = Vec::new();
    let mut rem = clamped;
    while rem > 2.0 {
        filters.push("atempo=2.0".to_string());
        rem /= 2.0;
    }
    while rem < 0.5 {
        filters.push("atempo=0.5".to_string());
        rem /= 0.5;
    }
    filters.push(format!("atempo={rem:.2}"));
    filters.join(",")
}

pub fn build_ffmpeg_export_args(
    timeline: &TimelineState,
    ass_file_path: &str,
    fonts_dir_path: &str,
    output_file_path: &str,
    hw: HardwareAcceleration,
) -> ExportCommandPlan {
    let width = timeline.project.resolution.width;
    let height = timeline.project.resolution.height;
    let main_video = timeline.video_tracks.first().and_then(|t| t.clips.first());
    let bgm_audio = timeline.audio_tracks.first().and_then(|t| t.clips.first());

    let mut args = vec!["-y".to_string()];
    if let Some(v) = main_video {
        args.extend([
            "-ss".into(),
            format!("{:.2}", v.source_start),
            "-to".into(),
            format!("{:.2}", v.source_end),
            "-i".into(),
            v.source_file.clone(),
        ]);
    }
    if let Some(a) = bgm_audio {
        args.extend(["-i".into(), a.source_file.clone()]);
    }

    let speed = main_video.map(|v| v.playback_rate).unwrap_or(1.0);
    let pts_factor = format!("{:.4}", 1.0 / speed);
    let escaped_ass = ass_file_path.replace('\\', "/");
    let escaped_fonts = fonts_dir_path.replace('\\', "/");

    let mut filter_parts = vec![
        format!(
            "[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,setpts={pts_factor}*(PTS-STARTPTS)[v_scaled]"
        ),
        format!("[v_scaled]ass='{escaped_ass}':fontsdir='{escaped_fonts}'[v_out]"),
    ];

    let atempo = build_chained_atempo(speed);
    let main_vol = main_video
        .map(|v| if v.muted { 0.0 } else { v.volume })
        .unwrap_or(1.0);

    if let Some(bgm) = bgm_audio {
        let fade_out_start = (bgm.end_time - bgm.fade_out).max(0.0);
        filter_parts.push(format!(
            "[0:a]asetpts=PTS-STARTPTS,{atempo},volume={main_vol}[a_speech]"
        ));
        filter_parts.push(format!(
            "[1:a]volume={},afade=t=in:st=0:d={},afade=t=out:st={fade_out_start:.2}:d={}[a_bgm]",
            bgm.volume, bgm.fade_in, bgm.fade_out
        ));
        filter_parts.push("[a_speech][a_bgm]amix=inputs=2:duration=first[a_out]".into());
    } else {
        filter_parts.push(format!(
            "[0:a]asetpts=PTS-STARTPTS,{atempo},volume={main_vol}[a_out]"
        ));
    }

    let (codec, extra_flags) = resolve_hardware_encoder(hw);
    args.extend([
        "-filter_complex".into(),
        filter_parts.join(";"),
        "-map".into(),
        "[v_out]".into(),
        "-map".into(),
        "[a_out]".into(),
        "-c:v".into(),
        codec.into(),
    ]);
    for flag in &extra_flags {
        args.push((*flag).into());
    }
    args.extend([
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        "192k".into(),
        output_file_path.into(),
    ]);

    let command_preview = format!("ffmpeg {}", args.join(" "));
    ExportCommandPlan {
        args,
        command_preview,
    }
}

