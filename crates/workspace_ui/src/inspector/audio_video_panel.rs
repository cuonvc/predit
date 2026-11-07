use crate::workspace::PreditWorkspace;
use editor_core::models::{TrackKind, TransitionType};
use editor_core::operations::{detach_video_audio, set_clip_transition};
use gpui::{Context, IntoElement, SharedString, div, prelude::*, px};
use ui_kit::CapCutTheme;

pub fn render_audio_video_panel(
    ws: &PreditWorkspace,
    track_type: TrackKind,
    clip_id: &str,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement + use<> {
    let cid = clip_id.to_string();
    let speeds = [0.25, 0.5, 1.0, 1.25, 1.5, 2.0, 4.0];

    let state = &ws.history.present;
    let selected_video = state
        .video_tracks
        .iter()
        .flat_map(|t| t.clips.iter())
        .find(|c| c.id == clip_id);
    let selected_audio = state
        .audio_tracks
        .iter()
        .flat_map(|t| t.clips.iter())
        .find(|a| a.id == clip_id);

    let current_vol = selected_video
        .map(|v| v.volume)
        .or_else(|| selected_audio.map(|a| a.volume))
        .unwrap_or(1.0);
    let current_speed = selected_video
        .map(|v| v.playback_rate)
        .or_else(|| selected_audio.map(|a| a.playback_rate))
        .unwrap_or(1.0);
    let current_trans_type = selected_video
        .and_then(|v| v.transition_out.as_ref().map(|t| t.transition_type))
        .unwrap_or(TransitionType::None);
    let current_trans_dur = selected_video
        .and_then(|v| v.transition_out.as_ref().map(|t| t.duration))
        .unwrap_or(0.5);

    let transitions = [
        (TransitionType::None, "None"),
        (TransitionType::Fade, "Fade"),
        (TransitionType::DipBlack, "Dip to Black"),
        (TransitionType::WipeLeft, "Wipe Left"),
        (TransitionType::Slide, "Slide"),
    ];
    let volumes = [0.0, 0.5, 1.0, 1.5, 2.0];
    let trans_durations = [0.2, 0.5, 0.8, 1.0, 1.5, 2.0];

    div()
        .flex()
        .flex_col()
        .gap_3()
        // 1. Audio Volume Control
        .child(
            div()
                .p_2p5()
                .rounded(px(6.0))
                .bg(CapCutTheme::bg_card())
                .border_1()
                .border_color(CapCutTheme::border())
                .flex()
                .flex_col()
                .gap_2()
                .child(
                    div()
                        .flex()
                        .justify_between()
                        .items_center()
                        .child(
                            div()
                                .text_xs()
                                .text_color(CapCutTheme::text_secondary())
                                .child("Audio Volume"),
                        )
                        .child(
                            div()
                                .text_xs()
                                .text_color(CapCutTheme::accent())
                                .child(SharedString::from(format!(
                                    "{:.0}%",
                                    current_vol * 100.0
                                ))),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .gap_1()
                        .children(volumes.into_iter().map(|vol| {
                            let is_active = (current_vol - vol).abs() < 0.05;
                            let cid_v = cid.clone();
                            div()
                                .id(SharedString::from(format!("vol-{vol}")))
                                .flex_1()
                                .py_1()
                                .rounded(px(4.0))
                                .bg(if is_active {
                                    CapCutTheme::accent()
                                } else {
                                    CapCutTheme::bg_input()
                                })
                                .border_1()
                                .border_color(CapCutTheme::border())
                                .flex()
                                .justify_center()
                                .text_xs()
                                .text_color(if is_active {
                                    CapCutTheme::bg_root()
                                } else {
                                    CapCutTheme::text_primary()
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let target_id = cid_v.clone();
                                    this.history.mutate(|s| {
                                        for tr in &mut s.video_tracks {
                                            for c in &mut tr.clips {
                                                if c.id == target_id {
                                                    c.volume = vol;
                                                    c.muted = vol == 0.0;
                                                }
                                            }
                                        }
                                        for tr in &mut s.audio_tracks {
                                            for c in &mut tr.clips {
                                                if c.id == target_id {
                                                    c.volume = vol;
                                                    c.muted = vol == 0.0;
                                                }
                                            }
                                        }
                                    });
                                    cx.notify();
                                }))
                                .child(SharedString::from(format!("{:.0}%", vol * 100.0)))
                        })),
                ),
        )
        // 2. Playback Speed Control
        .child(
            div()
                .p_2p5()
                .rounded(px(6.0))
                .bg(CapCutTheme::bg_card())
                .border_1()
                .border_color(CapCutTheme::border())
                .flex()
                .flex_col()
                .gap_2()
                .child(
                    div()
                        .text_xs()
                        .text_color(CapCutTheme::text_secondary())
                        .child("Playback Speed (Retiming + Chained atempo)"),
                )
                .child(
                    div()
                        .flex()
                        .flex_wrap()
                        .gap_1()
                        .children(speeds.into_iter().map(|spd| {
                            let is_active = (current_speed - spd).abs() < 0.05;
                            let cid_s = cid.clone();
                            div()
                                .id(SharedString::from(format!("speed-{spd}")))
                                .px_2()
                                .py_1()
                                .rounded(px(4.0))
                                .bg(if is_active {
                                    CapCutTheme::accent()
                                } else {
                                    CapCutTheme::bg_input()
                                })
                                .border_1()
                                .border_color(CapCutTheme::border())
                                .text_xs()
                                .text_color(if is_active {
                                    CapCutTheme::bg_root()
                                } else {
                                    CapCutTheme::text_primary()
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let target_id = cid_s.clone();
                                    this.history.mutate(|s| {
                                        for tr in &mut s.video_tracks {
                                            for c in &mut tr.clips {
                                                if c.id == target_id {
                                                    c.playback_rate = spd;
                                                }
                                            }
                                        }
                                        for tr in &mut s.audio_tracks {
                                            for c in &mut tr.clips {
                                                if c.id == target_id {
                                                    c.playback_rate = spd;
                                                }
                                            }
                                        }
                                    });
                                    cx.notify();
                                }))
                                .child(SharedString::from(format!("{spd}x")))
                        })),
                ),
        )
        // 3. Video Transition Styles & Detach Audio (Video clips only)
        .when(track_type == TrackKind::Video, |this| {
            let cid_detach = cid.clone();
            let cid_trans_base = cid.clone();
            let cid_dur_base = cid.clone();
            this.child(
                div()
                    .p_2p5()
                    .rounded(px(6.0))
                    .bg(CapCutTheme::bg_card())
                    .border_1()
                    .border_color(CapCutTheme::border())
                    .flex()
                    .flex_col()
                    .gap_2()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_1p5()
                            .text_xs()
                            .text_color(CapCutTheme::text_primary())
                            .child(div().text_color(CapCutTheme::accent()).child("⇄"))
                            .child("Transition Style"),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_wrap()
                            .gap_1p5()
                            .children(transitions.into_iter().map(|(t_type, label)| {
                                let is_active = current_trans_type == t_type;
                                let cid_t = cid_trans_base.clone();
                                div()
                                    .id(SharedString::from(format!("trans-{label}")))
                                    .px_2p5()
                                    .py_1()
                                    .rounded(px(4.0))
                                    .bg(if is_active {
                                        CapCutTheme::bg_input()
                                    } else {
                                        CapCutTheme::bg_root()
                                    })
                                    .border_1()
                                    .border_color(if is_active {
                                        CapCutTheme::accent()
                                    } else {
                                        CapCutTheme::border()
                                    })
                                    .text_xs()
                                    .text_color(if is_active {
                                        CapCutTheme::accent()
                                    } else {
                                        CapCutTheme::text_secondary()
                                    })
                                    .cursor_pointer()
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        let target_id = cid_t.clone();
                                        this.history.mutate(|s| {
                                            set_clip_transition(
                                                s,
                                                &target_id,
                                                t_type,
                                                current_trans_dur,
                                            );
                                        });
                                        cx.notify();
                                    }))
                                    .child(label)
                            })),
                    )
                    .when(current_trans_type != TransitionType::None, |this| {
                        this.child(
                            div()
                                .pt_1()
                                .flex()
                                .flex_col()
                                .gap_1()
                                .child(
                                    div()
                                        .flex()
                                        .justify_between()
                                        .text_xs()
                                        .child(
                                            div()
                                                .text_color(CapCutTheme::text_muted())
                                                .child("Transition Duration"),
                                        )
                                        .child(
                                            div()
                                                .text_color(CapCutTheme::accent())
                                                .child(SharedString::from(format!(
                                                    "{current_trans_dur:.1}s"
                                                ))),
                                        ),
                                )
                                .child(
                                    div().flex().gap_1().children(trans_durations.into_iter().map(
                                        |d_sec| {
                                            let active_d = (current_trans_dur - d_sec).abs() < 0.05;
                                            let cid_d = cid_dur_base.clone();
                                            div()
                                                .id(SharedString::from(format!("tdur-{d_sec}")))
                                                .flex_1()
                                                .py_0p5()
                                                .rounded(px(4.0))
                                                .bg(if active_d {
                                                    CapCutTheme::accent()
                                                } else {
                                                    CapCutTheme::bg_input()
                                                })
                                                .flex()
                                                .justify_center()
                                                .text_xs()
                                                .text_color(if active_d {
                                                    CapCutTheme::bg_root()
                                                } else {
                                                    CapCutTheme::text_secondary()
                                                })
                                                .cursor_pointer()
                                                .on_click(cx.listener(move |this, _, _, cx| {
                                                    let target_id = cid_d.clone();
                                                    this.history.mutate(|s| {
                                                        set_clip_transition(
                                                            s,
                                                            &target_id,
                                                            current_trans_type,
                                                            d_sec,
                                                        );
                                                    });
                                                    cx.notify();
                                                }))
                                                .child(SharedString::from(format!("{d_sec:.1}s")))
                                        },
                                    )),
                                ),
                        )
                    })
                    .child(
                        div()
                            .id("btn-detach-audio")
                            .mt_1()
                            .px_3()
                            .py_1p5()
                            .rounded(px(6.0))
                            .bg(CapCutTheme::clip_audio())
                            .border_1()
                            .border_color(CapCutTheme::accent())
                            .flex()
                            .justify_center()
                            .text_xs()
                            .text_color(CapCutTheme::text_primary())
                            .cursor_pointer()
                            .on_click(cx.listener(move |this, _, _, cx| {
                                let cid_ref = cid_detach.clone();
                                this.history
                                    .mutate(|s| detach_video_audio(s, Some(&cid_ref)));
                                cx.notify();
                            }))
                            .child("Detach Audio to Audio Track"),
                    ),
            )
        })
}
