/// Generates normalized waveform peak amplitudes (0.0..=1.0) for timeline audio clip rendering.
pub fn generate_waveform_peaks(clip_id: &str, bucket_count: usize) -> Vec<f32> {
    let seed = clip_id
        .bytes()
        .fold(1337u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64));
    (0..bucket_count)
        .map(|i| {
            let phase = (i as f32 * 0.43) + (seed % 97) as f32;
            (phase.sin().abs() * 0.65 + (phase * 0.37).cos().abs() * 0.35).clamp(0.12, 0.96)
        })
        .collect()
}

