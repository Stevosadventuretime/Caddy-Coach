# Building the drill golfer

`build3.py` makes `golfer-mesh.wasm` (a binary mesh, not WebAssembly) and its textures from the
MakeHuman base mesh (CC0). It shapes the body, merges the skeleton down to the bones the drill rig drives,
and dresses him:

- polo shirt and trousers draped over a per-slice convex hull (fabric bridges hollows instead of
  shrink-wrapping muscles), re-skinned to the body part they sit over, with blousing at the belt,
  a break at the shoe and pressed creases
- garment edges snapped to clean lines; ribbed sleeve cuffs and a belt with buckle and loops built as rings
- a polo collar (stand and fold-over leaf), placket and buttons
- golf shoes lofted from the foot (`shoes.py`, painted texture and normal map)
- a six-panel cap fitted to the head with a curved brim and button (`cap.py`)
- a short back-and-sides haircut as alpha-tested shells with a feathered hairline
- tileable micro detail for the knit, twill and skin pores (`detail.py`)

It also bakes ambient occlusion and paints the skin texture.

1. `git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git mh1`
   then sparse-checkout `makehuman/data/{3dobjs,rigs,eyes,skins,targets/macrodetails,targets/armslegs,targets/expression}`
2. `python3 detail.py` then `python3 build3.py` (needs numpy, scipy, Pillow). Output goes to `out/`.
3. Copy `out/golfer.bin` to the site as `golfer-mesh.wasm`, and the `out/golfer-*.jpg` files and
   `out/golfer-hair.png` alongside it.

`build2.py` is the previous version, kept for reference.
