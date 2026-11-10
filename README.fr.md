[ ![🇬🇧 English](https://img.shields.io/badge/%F0%9F%87%AC%F0%9F%87%A7-English-blue) ](README.md)

<img width="96" height="96" src="assets/icon.svg" align="right" alt="" />

# YouTube Auto Like

Like automatiquement les vidéos YouTube que vous choisissez : celles des chaînes auxquelles vous êtes abonné, de toutes les chaînes, ou seulement de votre propre liste, dès l'ouverture ou après un moment.

> [!NOTE]
> Ce dépôt est la suite maintenue de [austencm/youtube-auto-like](https://github.com/austencm/youtube-auto-like), pour les navigateurs basés sur Chromium (Brave, Chrome, Edge…) et pour Firefox. Il n'est pas tenu par son auteur d'origine : voir [À propos de ce fork](#à-propos-de-ce-fork).

## Ce qu'elle fait

- **Like ce que vous choisissez :** les chaînes auxquelles vous êtes abonné, toutes les chaînes, ou seulement votre liste « Toujours liker » ; les vidéos, les Shorts, ou les deux.
- **Quand vous le choisissez :** dès l'ouverture, après une part de la vidéo ou un nombre de minutes, ou à un moment au hasard. Les pubs ne sont pas comptées.
- **Jamais contre vous :** une vidéo que vous avez likée ou dislikée vous-même n'est jamais touchée, et dans le doute l'extension ne fait rien et dit pourquoi.
- **Deux listes :** « Toujours liker » et « Ne jamais liker », qui l'emporte toujours. Ajoutez une chaîne depuis la fenêtre de l'icône sur une de ses vidéos ou sur sa page, depuis l'historique des likes, ou en collant des liens et des @noms.
- **Pas cette fois, ou jamais :** écartez une vidéo pour ce visionnage, ou excluez-la pour de bon.
- **Montre ce qu'elle fait :** la fenêtre de l'icône dit ce qui arrive à la vidéo regardée et pourquoi, avec les actions qui le changent.
- **Vos listes vous appartiennent :** exportez-les en fichier ou en liste de liens, réimportez-les en voyant d'abord ce qui change.
- **Thèmes clair et sombre, 28 langues :** celle du navigateur, ou celle que vous choisissez dans les réglages. Seuls le français et l'anglais ont été relus par des locuteurs natifs pour l'instant : les corrections sont bienvenues (voir [Contribuer](#contribuer)).

## À propos de ce fork

[YouTube Auto Like](https://github.com/austencm/youtube-auto-like) a été créée par Austen Morgan en 2016. Sa dernière version, `v2.8.1`, date de décembre 2023, et elle n'est plus maintenue depuis. [Taknok](https://github.com/Taknok/youtube-auto-like) fait vivre un fork pour Firefox depuis 2017, qui ne fonctionne pas dans les navigateurs basés sur Chromium.

Ce fork la remet en service pour les navigateurs basés sur Chromium, réécrite pour Manifest V3, avec une nouvelle interface, et construit le même code pour Firefox. Il s'appuie sur l'expérience des deux projets, et les crédite : la structure et l'alerte de nouvelle version de l'original, la lecture des pages de YouTube et les règles du fork de Taknok.

Les versions poursuivent la numérotation d'origine : `3.0.0` est la première version de ce fork.

## Où la trouver ?

Deux canaux, chacun avec un lien qui ne change jamais :

| Canal | Ce que c'est | Lien |
| --- | --- | --- |
| **Latest** | La version la plus récente. | [Dernière version](https://github.com/NitramO-YT/youtube-auto-like/releases/latest) |
| **Beta** | La prochaine version, pour l'essayer avant tout le monde. | [Version bêta](https://github.com/NitramO-YT/youtube-auto-like/releases/tag/beta) |

Chaque version fournit :

- `youtube-auto-like.crx`, le paquet signé pour les navigateurs basés sur Chromium : le plus simple à installer et à mettre à jour ;
- `youtube-auto-like-chromium.zip`, la même extension à charger non empaquetée, depuis un dossier que vous gardez ;
- `youtube-auto-like.xpi`, pour Firefox 140 ou plus récent, signé par Mozilla.

Chaque fichier est accompagné de sa somme de contrôle `.sha256`. Le dernier zip est toujours à l'adresse
`https://github.com/NitramO-YT/youtube-auto-like/releases/latest/download/youtube-auto-like-chromium.zip`.

### Installer dans Firefox

Ouvrez la [dernière version](https://github.com/NitramO-YT/youtube-auto-like/releases/latest) dans Firefox et cliquez sur `youtube-auto-like.xpi` : Firefox demande s'il faut l'installer. Mozilla l'a signée sans la publier sur son site de modules, ce que Firefox exige de toute extension qu'il installe pour de bon.

### Installer le CRX (Chrome, Brave, Edge…)

1. Téléchargez `youtube-auto-like.crx`.
2. Ouvrez `chrome://extensions` (`brave://extensions` dans Brave, `edge://extensions` dans Edge).
3. Activez le **mode développeur**. Sans lui, le navigateur refuse un paquet qui ne vient pas de sa boutique, avec l'erreur `CRX_REQUIRED_PROOF_MISSING`.
4. Glissez le fichier sur la page des extensions, puis confirmez.

Vérifié dans Chrome et Brave sous Linux.

### Installer le zip

1. Téléchargez `youtube-auto-like-chromium.zip` et décompressez-le dans un dossier que vous garderez (le navigateur charge l'extension depuis là).
2. Ouvrez `chrome://extensions` (`brave://extensions` dans Brave, `edge://extensions` dans Edge).
3. Activez le **mode développeur**.
4. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier décompressé.

### Mettre à jour

L'extension vérifie sur GitHub si une nouvelle version existe, toutes les 30 minutes par défaut (réglages, section Divers). Quand c'est le cas, son icône affiche une pastille, et la fenêtre de l'icône donne le lien.

Pour mettre à jour le CRX, glissez le nouveau sur la page des extensions, comme pour l'installation. Pour mettre à jour une extension non empaquetée, remplacez le contenu de son dossier par le nouveau zip, puis cliquez sur le bouton de rechargement de l'extension dans la page des extensions. Dans les deux cas, vos réglages et vos listes sont conservés : l'extension garde le même identifiant d'une version à l'autre.

Firefox met l'extension à jour tout seul : il lit le fichier `updates.json` de la dernière version publiée, et installe la version qu'il indique.

### Vérifier un téléchargement

Placez le fichier `.sha256` à côté du fichier téléchargé, puis lancez :

```sh
sha256sum -c youtube-auto-like-chromium.zip.sha256
```

## Vie privée

Tout ce que l'extension garde reste dans votre navigateur : vos réglages, vos listes, l'historique des likes qu'elle a posés et, seulement quand le mode débogage est activé, son journal. Rien n'est envoyé à l'auteur, et il n'y a aucun pistage.

L'extension ne se connecte qu'à deux endroits :

- **GitHub** (`api.github.com`), pour savoir si une nouvelle version existe, à la fréquence que vous choisissez, ou jamais. GitHub voit alors votre adresse IP.
- **YouTube**, seulement quand vous ajoutez des chaînes par lien ou importez une liste de liens, pour savoir de quelle chaîne il s'agit. Ces demandes portent vos cookies YouTube, comme si vous ouvriez la page.

Dans Firefox, c'est Firefox lui-même, et non l'extension, qui lit aussi sur GitHub le fichier `updates.json` des mises à jour.

### Permissions

| Permission | Pourquoi |
| --- | --- |
| Accès à `www.youtube.com` | Lire la vidéo regardée, cliquer sur son bouton J'aime, et retrouver une chaîne d'après un lien. |
| `storage` | Garder vos réglages, vos listes et l'historique dans le navigateur. |
| `alarms` | Vérifier s'il existe une nouvelle version, à la fréquence choisie. |
| `scripting` | Démarrer dans les onglets YouTube déjà ouverts quand l'extension est installée ou mise à jour, sans les recharger. |

## J'ai un problème

Ouvrez les réglages de l'extension, puis **À propos › Signaler un problème**. Cela ouvre une issue qui contient déjà la version, le navigateur et les réglages. Pour y joindre ce qu'a fait l'extension, activez le **mode débogage** (réglages, section Divers), refaites ce qui pose problème, puis signalez-le.

Pour une faille de sécurité, suivez plutôt la [politique de sécurité](SECURITY.md).

Cela vaut aussi pour la version Firefox de ce projet. [Le fork de Taknok](https://github.com/Taknok/youtube-auto-like) est une autre extension, avec ses propres issues.

## Soutenir le projet

L'extension est gratuite, et le restera. Si elle vous est utile, vous pouvez soutenir son développement sur [Ko-fi](https://ko-fi.com/NitramO).

Les projets dont elle vient peuvent l'être aussi : Austen Morgan, qui l'a créée, sur [Buy Me a Coffee](https://www.buymeacoffee.com/austen), et Taknok, qui la fait vivre pour Firefox depuis 2017, par [PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=F8J6T6WHJBRAA).

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) : construire, tester et essayer l'extension, l'organisation du code, et comment aider aux traductions.

## Licence

[MIT](LICENSE). Copyright (c) 2016 Austen Morgan, Copyright (c) 2026 Martin (NitramO).
