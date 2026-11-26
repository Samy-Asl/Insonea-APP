# INsonea App

INsonea utilise le micro de l’appareil pour estimer le niveau sonore, signaler les dépassements de seuil et afficher un bilan de session.

- [Ouvrir l’application](https://samy-asl.github.io/Insonea-APP/)
- [Voir la vitrine](https://samy-asl.github.io/Insonea/)

## Utilisation

1. Clique sur **Démarrer** et autorise le microphone.
2. Suis le niveau estimé et ajuste les seuils dans **Configuration** si nécessaire.
3. Clique sur **Arrêter** pour libérer le microphone, puis sur **Bilan** pour consulter les résultats de la session.

Le bilan indique la moyenne des lectures, le pic, le nombre de passages au-dessus du seuil d’alerte et leur durée cumulée. Quitter l’onglet arrête la mesure. Pour recommencer, clique sur **Démarrer**.

Le son est traité dans le navigateur et le bilan reste disponible dans l’onglet jusqu’à la prochaine session. Les niveaux dépendent du microphone et de ses réglages. La conversion utilise une référence fixe, sans étalonnage par appareil.

## Lancer en local

À la racine du dépôt, démarre un serveur statique avec `python -m http.server 8000`, puis ouvre `http://localhost:8000`. La version publiée s’ouvre en HTTPS.
