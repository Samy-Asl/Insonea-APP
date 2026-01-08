if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW enregistré', reg))
            .catch(err => console.log('SW erreur', err));
    });
}
