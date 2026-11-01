//! MD Fit desktop: a locked-down native window around https://mdfit-srq.vercel.app
//!
//! Security model (Tauri 2):
//! - The website gets NO native capabilities: no file system, shell, clipboard, process or IPC commands.
//! - Navigation is pinned to MD Fit and Stripe's hosted checkout/billing pages. Anything else is refused,
//!   so the window can't be steered to a phishing page or another site.
//! - Traffic is HTTPS only (the site sends HSTS), and the API behind it is only reachable through MD Fit's edge guard.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

const HOME: &str = "https://mdfit-srq.vercel.app/account";
const ALLOWED_HOSTS: [&str; 3] = ["mdfit-srq.vercel.app", "checkout.stripe.com", "billing.stripe.com"];

fn allowed(url: &tauri::Url) -> bool {
    match url.scheme() {
        "https" => url.host_str().map_or(false, |h| ALLOWED_HOSTS.contains(&h)),
        "about" | "blob" | "data" => true,
        _ => false,
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let home = HOME.parse().expect("valid home URL");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(home))
                .title("MD Fit")
                .inner_size(1240.0, 840.0)
                .min_inner_size(380.0, 620.0)
                .on_navigation(|url| allowed(url))
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MD Fit");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn navigation_is_pinned() {
        assert!(allowed(&"https://mdfit-srq.vercel.app/account#home".parse().unwrap()));
        assert!(allowed(&"https://checkout.stripe.com/c/pay/cs_test".parse().unwrap()));
        assert!(!allowed(&"http://mdfit-srq.vercel.app/".parse().unwrap()), "no plain http");
        assert!(!allowed(&"https://evil.example/login".parse().unwrap()), "no other sites");
        assert!(!allowed(&"https://mdfit-srq.vercel.app.evil.example/".parse().unwrap()), "no look-alike hosts");
        assert!(!allowed(&"file:///etc/passwd".parse().unwrap()), "no local files");
    }
}
