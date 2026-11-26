# Insonea

[Ouvrir Insonea](https://samy-asl.github.io/Insonea-APP/) · [Vitrine du projet](https://samy-asl.github.io/Insonea/)

Insonea permet de suivre le bruit pendant un cours et de comparer deux lieux sur le même téléphone. L’application traite le signal du microphone sur l’appareil et conserve uniquement des statistiques numériques.

## Mesurer un cours

1. Saisir un lieu ou toucher un lieu récent. Le nom de session est libre. Par défaut, il reprend le lieu, la date et l’heure.
2. Choisir un seuil, démarrer et autoriser le micro. La courbe affiche la dernière minute. Néo réagit quand le niveau atteint le seuil.
3. Garder l’application visible. Un verrouillage d’écran est évité lorsque le navigateur accorde cette possibilité. Un passage en arrière-plan termine la mesure et conserve le bilan partiel.
4. Toucher **Terminer et voir le bilan**. L’historique permet de rouvrir les bilans et de comparer deux cours sur la même échelle de temps et avec un seuil commun.

## Lire les résultats

Le processeur Web Audio calcule la puissance moyenne du signal mono sur des fenêtres successives de 250 ms. Le niveau affiché est `94 + 10 × log10(puissance)`, borné entre 0 et 94. Cette référence est fixe et dépend du microphone. Les valeurs sont des estimations sans étalonnage acoustique ni pondération A.

La moyenne du bilan est calculée sur la somme des énergies divisée par la durée effectivement mesurée, avant la conversion en décibels. Le pic correspond au quart de seconde le plus fort. Un épisode commence lorsque le niveau atteint ou dépasse le seuil. Un histogramme de durées permet de recalculer le temps au-dessus de tout seuil entier de 1 à 94 dB. Le graphe du bilan affiche la moyenne énergétique et le maximum de chaque tranche de cinq secondes, y compris la dernière tranche partielle.

Les sessions sont sauvegardées sur cet appareil dès la première fenêtre complète, toutes les cinq secondes et à l’arrêt. Une fermeture brutale peut perdre les dernières secondes depuis la dernière sauvegarde. En cas de stockage plein ou bloqué, un message indique que le bilan est disponible dans l’onglet. Effacer les données du site supprime l’historique.

## Développement

Servir le dossier avec un serveur statique, par exemple `python -m http.server 8000`, puis ouvrir `http://localhost:8000`. Le micro nécessite HTTPS ou localhost et un navigateur compatible AudioWorklet. L’application peut fonctionner hors ligne après une première ouverture complète. Les calculs et les graphiques sont écrits en JavaScript, sans dépendance externe.

Vérifier les calculs avec Node.js 22.12 ou ultérieur en exécutant `node --test measure.test.mjs`.
