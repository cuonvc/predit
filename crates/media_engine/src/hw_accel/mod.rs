pub mod macos_metal;
pub mod windows_dx11;

pub fn active_hw_backend_label() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "Windows DirectX 11 + NVENC"
    }
    #[cfg(target_os = "macos")]
    {
        "macOS Metal + VideoToolbox"
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        "Software / Vulkan"
    }
}

