# Building the drill golfer

`build2.py` makes `golfer-mesh.wasm` (a binary mesh, not WebAssembly) and `golfer-skin.jpg` from the
MakeHuman base mesh (CC0). It shapes the body, merges the skeleton down to the bones the drill rig drives,
makes the polo shirt, trousers, belt, shoes, glove and cap, bakes ambient occlusion and paints the skin texture.

1. `git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git mh1`
   then sparse-checkout `makehuman/data/{3dobjs,rigs,eyes,skins,targets/macrodetails,targets/armslegs,targets/expression}`
2. `python3 build2.py` (needs numpy, scipy, Pillow). Output goes to `out/`.
3. Copy `out/golfer.bin` to the site as `golfer-mesh.wasm`, and `out/golfer-skin.jpg` alongside it.
