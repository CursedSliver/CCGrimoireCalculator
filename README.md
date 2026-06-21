# CC Grimoire Calculator
This is a handy tool to calculate various things related to the Grimoire minigame in Cookie clicker, as well as for comboing in general.

The spells section should be fairly intuitive to use and self-explanatory. 
If you have never heard of this before and don't know a lot about the game, you can safely ignore all the other sections.

## Sections
- The spells section allows you to quickly see magic counts related to spells, as well as magic regeneration times after casting each spell from full magic.
- The arbitrary multicast section tells you how to buy and sell wizard towers to execute your combo.
- The advanced GFD section quickly computes common transmutation and GFD refunds.
- The transmutation graph section tells you how to transmute GFDs to other GFDs.

## Local hosting
- Download the repository.
- Open the `index.html` file in your browser.
- You can also host it on a local server, but you will need to change the `src` attribute of the `<script>` tags in the `index.html` file to point to the local files.

## Modding & setup
- Download the repository.
- You will need to install dependencies for tailwindCSS. `npm install tailwindcss @tailwindcss/cli`
- Run `npm run tailwindStyles` to build the tailwindCSS file. You will need to rerun this after every time your terminal or IDE shuts down.
- You can now open the `index.html` file in your browser or use whatever other method you wish to host the server (such as Live Reload). This is a pure frontend app. 
- Happy modding!