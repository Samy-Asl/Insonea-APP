document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (typeof stopMonitoring === 'function') {
            stopMonitoring();
            console.log('⏸ Micro stoppé (app en arrière-plan)');
        }
    } else {
        if (typeof startMonitoring === 'function') {
            startMonitoring();
            console.log('▶️ Micro relancé (app active)');
        }
    }
});