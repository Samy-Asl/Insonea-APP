document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMonitoring();
});
window.addEventListener('pagehide', stopMonitoring);
