import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const TILE_WIDTH = 0.52;
const TILE_HEIGHT = 0.72;
const TILE_DEPTH = 0.18;
const DICE_TOP_ROTATIONS = {
  1: [0, 0, 0],
  2: [0, 0, Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [0, 0, -Math.PI / 2],
  6: [Math.PI, 0, 0]
};

function createDiceFaceTexture(value) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#fffdf4';
  context.fillRect(0, 0, 128, 128);
  context.strokeStyle = '#d9d1bd';
  context.lineWidth = 5;
  context.strokeRect(3, 3, 122, 122);
  const positions = {
    1: [[64, 64]],
    2: [[34, 34], [94, 94]],
    3: [[34, 34], [64, 64], [94, 94]],
    4: [[34, 34], [94, 34], [34, 94], [94, 94]],
    5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]],
    6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]]
  };
  (positions[value] || []).forEach(([x, y]) => {
    context.fillStyle = '#b72f35';
    context.beginPath();
    context.arc(x, y, 11, 0, Math.PI * 2);
    context.fill();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTileTexture(label, hidden = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 352;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = hidden ? '#174c58' : '#fbf7e9';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = hidden ? '#7dc8bd' : '#d2c8ad';
  context.lineWidth = 12;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  if (hidden) {
    context.strokeStyle = 'rgba(190, 235, 220, 0.5)';
    context.lineWidth = 5;
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += 34) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x - canvas.height, canvas.height);
      context.stroke();
    }
  } else if (label?.endsWith('桐')) {
    const count = Number(label[0]);
    const patterns = {
      1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
      7: [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]],
      8: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
      9: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
    };
    const palette = ['#b63836', '#277653', '#305b9b'];
    (patterns[count] || []).forEach(([x, y], index) => {
      const px = 128 + x * 61;
      const py = 176 + y * 61;
      const radius = count === 1 ? 49 : 30;
      context.fillStyle = '#dfd5bd';
      context.beginPath();
      context.arc(px, py, radius + 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = palette[index % palette.length];
      context.beginPath();
      context.arc(px, py, radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.55)';
      context.beginPath();
      context.arc(px - radius * 0.28, py - radius * 0.32, radius * 0.2, 0, Math.PI * 2);
      context.fill();
    });
  } else if (label?.endsWith('条')) {
    const count = Number(label[0]);
    context.lineCap = 'round';
    for (let index = 0; index < count; index += 1) {
      const x = 80 + (index % 2) * 94;
      const y = 55 + Math.floor(index / 2) * 57;
      context.strokeStyle = index % 3 === 0 ? '#c7473d' : '#287852';
      context.lineWidth = 17;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 10, y + 38);
      context.stroke();
      context.fillStyle = '#345e9a';
      context.beginPath();
      context.arc(x + 5, y + 3, 7, 0, Math.PI * 2);
      context.fill();
    }
  } else if (label?.endsWith('万')) {
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#c43d37';
    context.font = 'bold 145px "Microsoft YaHei", sans-serif';
    context.fillText(label[0], 128, 133);
    context.fillStyle = '#253b5e';
    context.font = 'bold 74px "Microsoft YaHei", sans-serif';
    context.fillText('万', 128, 260);
  } else {
    const flowerColors = { 春: '#51965c', 夏: '#d46546', 秋: '#d6a840', 冬: '#577cac', 梅: '#c74756', 兰: '#5b9566', 竹: '#3d8261', 菊: '#d59b39' };
    const value = label?.[0];
    const color = flowerColors[value] || (value === '中' ? '#c63d37' : value === '发' ? '#27764f' : '#273d62');
    if (label && '春夏秋冬梅兰竹菊'.includes(value) && label.endsWith('花')) {
      context.fillStyle = color;
      context.strokeStyle = '#e7c867';
      context.lineWidth = 7;
      for (let index = 0; index < 6; index += 1) {
        context.beginPath();
        context.ellipse(128, 136, 26, 55, index * Math.PI / 3, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
      context.fillStyle = '#f8df90';
      context.beginPath();
      context.arc(128, 136, 19, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = color;
      context.font = 'bold 68px "Microsoft YaHei", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(value, 128, 270);
    } else {
      context.fillStyle = color;
      context.font = `bold ${label.length > 2 ? 76 : label.length === 2 ? 102 : 150}px "Microsoft YaHei", sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label || '牌', canvas.width / 2, canvas.height / 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addTile(group, geometry, sharedMaterials, textureCache, tile, position, rotationY = 0, hidden = false, scale = 1, rotationX = 0) {
  const label = tile?.label || '牌';
  const cacheKey = hidden ? 'hidden' : label;
  if (!textureCache.has(cacheKey)) textureCache.set(cacheKey, createTileTexture(label, hidden));
  const texture = textureCache.get(cacheKey);
  const face = texture
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.76 })
    : sharedMaterials.face;
  const side = hidden ? sharedMaterials.back : sharedMaterials.side;
  const mesh = new THREE.Mesh(geometry, [side, side, face, side, face, sharedMaterials.back]);
  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.set(rotationX, rotationY, 0);
  mesh.scale.setScalar(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBox(scene, material, position, size, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function orderTiles(tiles) {
  const suits = { 万: 0, 条: 1, 桐: 2, 字: 3, 花: 4 };
  const honors = { 东: 1, 南: 2, 西: 3, 北: 4, 中: 5, 发: 6, 白: 7 };
  return [...tiles].sort((left, right) => {
    const suitOrder = suits[left.suit] - suits[right.suit];
    if (suitOrder) return suitOrder;
    if (left.suit === '字') return honors[left.value] - honors[right.value];
    if (left.suit === '花') return '春夏秋冬梅兰竹菊'.indexOf(left.value) - '春夏秋冬梅兰竹菊'.indexOf(right.value);
    return Number(left.value) - Number(right.value);
  });
}

export default function MahjongTable3D({
  game,
  playerName,
  localHandGroups,
  selectedTileId,
  suggestedTileId,
  actionEvent,
  canDraw,
  onSelectTile,
  onDrawTile,
  diceCeremony = null
}) {
  const hostRef = useRef(null);
  const gameRef = useRef(game);
  const playerNameRef = useRef(playerName);
  const selectedTileIdRef = useRef(selectedTileId);
  const suggestedTileIdRef = useRef(suggestedTileId);
  const actionEventRef = useRef(actionEvent);
  const canDrawRef = useRef(canDraw);
  const onSelectTileRef = useRef(onSelectTile);
  const onDrawTileRef = useRef(onDrawTile);
  const localHandGroupsRef = useRef(localHandGroups);
  const diceCeremonyRef = useRef(diceCeremony);
  const rebuildRef = useRef(null);
  gameRef.current = game;
  playerNameRef.current = playerName;
  selectedTileIdRef.current = selectedTileId;
  suggestedTileIdRef.current = suggestedTileId;
  actionEventRef.current = actionEvent;
  canDrawRef.current = canDraw;
  onSelectTileRef.current = onSelectTile;
  onDrawTileRef.current = onDrawTile;
  localHandGroupsRef.current = localHandGroups;
  diceCeremonyRef.current = diceCeremony;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#171a37');
    scene.fog = new THREE.Fog('#171a37', 28, 55);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 20, 13);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.1 : 1.5));
    renderer.shadowMap.enabled = window.innerWidth >= 700;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 9;
    controls.maxDistance = 23;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.update();

    scene.add(new THREE.HemisphereLight('#d7edff', '#183d34', 2.2));
    const keyLight = new THREE.DirectionalLight('#fff0d0', 3.1);
    keyLight.position.set(-5, 13, 8);
    keyLight.castShadow = renderer.shadowMap.enabled;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight('#51d6c2', 38, 22);
    rimLight.position.set(5, 5, -5);
    scene.add(rimLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: '#1b1b3c', roughness: 0.92 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.72;
    ground.receiveShadow = true;
    scene.add(ground);

    const felt = new THREE.MeshStandardMaterial({ color: '#087e70', roughness: 0.78 });
    const rail = new THREE.MeshStandardMaterial({ color: '#153b48', roughness: 0.3, metalness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: '#d9ae50', roughness: 0.35, metalness: 0.6 });
    const tileSide = new THREE.MeshStandardMaterial({ color: '#ded5bd', roughness: 0.62 });
    const tileBack = new THREE.MeshStandardMaterial({ color: '#174c58', roughness: 0.72 });
    const tileFace = new THREE.MeshStandardMaterial({ color: '#fbf7e9', roughness: 0.76 });

    const base = addBox(scene, rail, [0, -0.02, 0], [12.2, 0.72, 12.2]);
    base.castShadow = true;
    addBox(scene, gold, [0, 0.34, 0], [11.96, 0.06, 11.96], false);
    addBox(scene, felt, [0, 0.43, 0], [11.6, 0.2, 11.6], false);
    for (const x of [-4.9, 4.9]) {
      for (const z of [-4.9, 4.9]) {
        addBox(scene, rail, [x, -1.02, z], [0.46, 1.42, 0.46]);
        addBox(scene, gold, [x, -0.43, z], [0.55, 0.07, 0.55], false);
      }
    }

    const backCanvas = document.createElement('canvas');
    backCanvas.width = 128;
    backCanvas.height = 128;
    const backContext = backCanvas.getContext('2d');
    if (backContext) {
      backContext.fillStyle = '#174c58';
      backContext.fillRect(0, 0, 128, 128);
      backContext.strokeStyle = '#75bcb1';
      backContext.lineWidth = 5;
      backContext.strokeRect(8, 8, 112, 112);
      backContext.beginPath();
      backContext.moveTo(14, 14);
      backContext.lineTo(114, 114);
      backContext.moveTo(114, 14);
      backContext.lineTo(14, 114);
      backContext.stroke();
    }
    const backTexture = new THREE.CanvasTexture(backCanvas);
    const wallTop = new THREE.MeshStandardMaterial({ map: backTexture, roughness: 0.72 });
    const wallSide = new THREE.MeshStandardMaterial({ color: '#e6dcc5', roughness: 0.64 });
    const wallGeometry = new THREE.BoxGeometry(0.5, 0.18, 0.32);
    const wallGroup = new THREE.Group();
    scene.add(wallGroup);
    const diceGroup = new THREE.Group();
    const diceGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const diceTextures = [2, 5, 1, 6, 3, 4].map(createDiceFaceTexture);
    const diceMaterials = diceTextures.map((map) => new THREE.MeshStandardMaterial({
      map,
      roughness: 0.36,
      metalness: 0.02
    }));
    const dicePositions = {
      东: [-0.54, -0.54],
      南: [0.54, -0.54],
      西: [0.54, 0.54],
      北: [-0.54, 0.54]
    };
    const diceMeshes = new Map();
    ['东', '南', '西', '北'].forEach((seat) => {
      const die = new THREE.Mesh(diceGeometry, diceMaterials);
      const [x, z] = dicePositions[seat];
      die.position.set(x, 0.8, z);
      die.castShadow = true;
      die.receiveShadow = true;
      die.userData.seat = seat;
      diceGroup.add(die);
      diceMeshes.set(seat, die);
    });
    scene.add(diceGroup);
    const rebuildWall = (currentGame) => {
      wallGroup.clear();
      if (diceCeremonyRef.current) return;
      const stackCount = Math.ceil(currentGame.drawPile.length / 2);
      const stacksPerSide = Math.ceil(stackCount / 4);
      for (let index = 0; index < stackCount; index += 1) {
        const side = Math.floor(index / stacksPerSide);
        const stackOnSide = index - side * stacksPerSide;
        const along = -4.52 + (18 - stacksPerSide) * 0.266 + stackOnSide * 0.532;
        const firstTileIndex = index * 2;
        const tilesInStack = Math.min(2, currentGame.drawPile.length - firstTileIndex);
        for (let level = 0; level < tilesInStack; level += 1) {
          let x = along;
          let z = -4.52;
          let rotation = 0;
          if (side === 1) { z = along; x = 4.52; rotation = Math.PI / 2; }
          if (side === 2) { x = -along; z = 4.52; rotation = Math.PI; }
          if (side === 3) { z = -along; x = -4.52; rotation = -Math.PI / 2; }
          const wallTile = new THREE.Mesh(wallGeometry, [wallSide, wallSide, wallTop, wallSide, wallSide, wallSide]);
          wallTile.position.set(x, 0.65 + level * 0.19, z);
          wallTile.rotation.y = rotation;
          wallTile.castShadow = true;
          wallTile.receiveShadow = true;
          wallTile.userData.tableAction = 'draw';
          wallGroup.add(wallTile);
        }
      }
    };
    rebuildWall(gameRef.current);

    const cloudMeshes = [];
    const cloudGeometry = new THREE.SphereGeometry(0.72, 14, 10);
    for (let index = 0; index < 32; index += 1) {
      const side = Math.floor(index / 8);
      const puff = index % 8;
      const along = (puff - 3.5) * 1.05;
      const material = new THREE.MeshBasicMaterial({
        color: puff % 3 === 0 ? '#f4ffff' : '#ccefeb',
        transparent: true,
        opacity: 0.2 + (puff % 3) * 0.035,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const cloud = new THREE.Mesh(cloudGeometry, material);
      const y = -0.72 + (puff % 3) * 0.16;
      if (side === 0) cloud.position.set(along, y, 6.15);
      else if (side === 1) cloud.position.set(6.15, y, along);
      else if (side === 2) cloud.position.set(-along, y, -6.15);
      else cloud.position.set(-6.15, y, -along);
      cloud.scale.set(1.35 + (puff % 2) * 0.2, 0.72, 0.88);
      cloud.userData.phase = index * 0.83;
      cloud.userData.origin = cloud.position.clone();
      scene.add(cloud);
      cloudMeshes.push(cloud);
    }

    const tileGeometry = new THREE.BoxGeometry(TILE_WIDTH, TILE_HEIGHT, TILE_DEPTH);
    const tileTextures = new Map();
    const tileGroup = new THREE.Group();
    scene.add(tileGroup);
    const sharedMaterials = { side: tileSide, back: tileBack, face: tileFace };

    const clearTiles = () => {
      tileGroup.children.forEach((mesh) => {
        mesh.material.forEach((material) => {
          if (material !== tileSide && material !== tileBack && material !== tileFace) material.dispose();
        });
      });
      tileGroup.clear();
    };

    const rebuildTiles = (currentGame, currentPlayerName) => {
      clearTiles();
      if (diceCeremonyRef.current) return;
      const localPlayer = currentGame.players.find((player) => player.name === currentPlayerName);
      const localSeatIndex = Math.max(0, currentGame.players.indexOf(localPlayer));

      currentGame.players.forEach((player, playerIndex) => {
        const relativeSeat = (playerIndex - localSeatIndex + 4) % 4;
        const hand = player.hand || [];
        if (relativeSeat === 0) {
          const groups = localHandGroupsRef.current?.length
            ? localHandGroupsRef.current
            : [orderTiles(hand)];
          const step = 0.47;
          const groupGap = 0.18;
          const hasDrawnTile = hand.length === 13 - (player.melds?.length || 0) * 3 + 1 &&
            hand.some((tile) => tile.id === player.drawnTileId);
          const drawnTile = hasDrawnTile ? hand.find((tile) => tile.id === player.drawnTileId) : null;
          const visibleGroups = drawnTile
            ? [...groups.map((group) => group.filter((tile) => tile.id !== drawnTile.id)).filter((group) => group.length), [drawnTile]]
            : groups;
          const drawGap = drawnTile ? 1.35 : 0;
          const width = Math.max(0, hand.length - 1) * step +
            Math.max(0, visibleGroups.length - 1) * groupGap + drawGap;
          let cursor = -width / 2;
          visibleGroups.forEach((group, groupIndex) => {
            if (drawnTile && group.length === 1 && group[0].id === drawnTile.id) cursor += drawGap;
            group.forEach((tile) => {
              const mesh = addTile(tileGroup, tileGeometry, sharedMaterials, tileTextures, tile, {
                x: cursor,
                y: 0.83,
                z: drawnTile?.id === tile.id ? 4.42 : 4.92
              }, 0, false, 0.82);
              mesh.userData.handTileId = tile.id;
              mesh.userData.baseY = mesh.position.y;
              cursor += step;
            });
            if (groupIndex < groups.length - 1) cursor += groupGap;
          });
        } else {
          const arranged = orderTiles(hand);
          const step = 0.47;
          const scale = 0.82;
          const hasDrawnTile = hand.length === 13 - (player.melds?.length || 0) * 3 + 1 &&
            hand.some((tile) => tile.id === player.drawnTileId);
          const ordered = hasDrawnTile
            ? [...arranged.filter((tile) => tile.id !== player.drawnTileId), hand.find((tile) => tile.id === player.drawnTileId)]
            : arranged;
          const drawGap = hasDrawnTile ? 1.35 : 0;
          const width = Math.max(0, ordered.length - 1) * step + drawGap;
          let cursor = -width / 2;
          ordered.forEach((tile, index) => {
            if (hasDrawnTile && index === ordered.length - 1) cursor += drawGap;
            const offset = cursor;
            cursor += step;
            let position;
            let rotation = 0;
            if (relativeSeat === 2) {
              position = { x: offset, y: 0.83, z: tile.id === player.drawnTileId && hasDrawnTile ? -3.72 : -4.15 };
              rotation = Math.PI;
            } else if (relativeSeat === 1) {
              position = { x: tile.id === player.drawnTileId && hasDrawnTile ? -3.72 : -4.15, y: 0.83, z: offset };
              rotation = -Math.PI / 2;
            } else {
              position = { x: tile.id === player.drawnTileId && hasDrawnTile ? 3.72 : 4.15, y: 0.83, z: offset };
              rotation = Math.PI / 2;
            }
            addTile(tileGroup, tileGeometry, sharedMaterials, tileTextures, tile, position, rotation, true, scale);
          });
        }
      });

      currentGame.players.forEach((player, playerIndex) => {
        const relativeSeat = (playerIndex - localSeatIndex + 4) % 4;
        (player.discard || []).slice(-24).forEach((tile, index) => {
          const row = Math.floor(index / 4);
          const column = index % 4;
          const across = (column - 1.5) * 0.34;
          const deep = 1.1 + row * 0.42;
          const position = relativeSeat === 0 ? { x: across, z: deep }
            : relativeSeat === 2 ? { x: -across, z: -deep }
              : relativeSeat === 1 ? { x: -deep, z: -across }
                : { x: deep, z: across };
          const latestAction = actionEventRef.current;
          const isLatestDrop = latestAction?.type === 'discard' && latestAction.tile?.id === tile.id;
          const mesh = addTile(tileGroup, tileGeometry, sharedMaterials, tileTextures, tile, {
            x: position.x,
            y: isLatestDrop ? 2 : 0.66,
            z: position.z
          }, relativeSeat === 1 ? Math.PI / 2 : relativeSeat === 3 ? -Math.PI / 2 : relativeSeat === 2 ? Math.PI : 0, false, 0.56, -Math.PI / 2);
          if (isLatestDrop) mesh.userData.dropStartedAt = performance.now();
        });
      });

      currentGame.players.forEach((player, playerIndex) => {
        const relativeSeat = (playerIndex - localSeatIndex + 4) % 4;
        (player.melds || []).forEach((meld, meldIndex) => {
          meld.tiles.forEach((tile, tileIndex) => {
            const step = tileIndex - (meld.tiles.length - 1) / 2;
            const position = relativeSeat === 0 ? { x: -3.7 + meldIndex * 0.92 + step * 0.31, z: 3.38 }
              : relativeSeat === 2 ? { x: 3.7 - meldIndex * 0.92 - step * 0.31, z: -3.38 }
                : relativeSeat === 1 ? { x: -3.38, z: 3.7 - meldIndex * 0.92 - step * 0.31 }
                  : { x: 3.38, z: -3.7 + meldIndex * 0.92 + step * 0.31 };
            addTile(tileGroup, tileGeometry, sharedMaterials, tileTextures, tile, {
              x: position.x,
              y: 0.68,
              z: position.z
            }, relativeSeat === 1 ? Math.PI / 2 : relativeSeat === 3 ? -Math.PI / 2 : 0, false, 0.53, -Math.PI / 2);
          });
        });
      });
    };

    const rebuild = (currentGame, currentPlayerName) => {
      if (diceCeremonyRef.current) {
        clearTiles();
        wallGroup.clear();
        return;
      }
      rebuildTiles(currentGame, currentPlayerName);
      rebuildWall(currentGame);
    };
    rebuildRef.current = rebuild;
    rebuild(gameRef.current, playerNameRef.current);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart = null;
    const onPointerDown = (event) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event) => {
      if (!pointerStart) return;
      const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      pointerStart = null;
      if (moved > 9) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const clickableObjects = [
        ...tileGroup.children.filter((mesh) => mesh.userData.handTileId),
        ...wallGroup.children
      ];
      const hit = raycaster.intersectObjects(clickableObjects, false)
        .find((intersection) => intersection.object.userData.tableAction === 'draw' || intersection.object.userData.handTileId)?.object;
      if (!hit) return;
      if (hit.userData.tableAction === 'draw' && canDrawRef.current) {
        onDrawTileRef.current();
      } else if (hit.userData.handTileId) {
        onSelectTileRef.current(hit.userData.handTileId);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const resizeObserver = new ResizeObserver(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (width < height) {
        camera.fov = 54;
        camera.position.set(0, 21, 12);
      } else {
        camera.fov = 34;
        if (camera.position.length() < 15) camera.position.set(0, 20, 13);
      }
      camera.updateProjectionMatrix();
      controls.update();
    });
    resizeObserver.observe(host);

    let frame;
    const startedAt = performance.now();
    const render = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const ceremony = diceCeremonyRef.current;
      diceGroup.visible = Boolean(ceremony);
      if (ceremony) {
        diceMeshes.forEach((die) => {
          const seat = die.userData.seat;
          const roll = ceremony.rolls.find((entry) => entry.seat === seat) ||
            [...ceremony.history].reverse().flat().find((entry) => entry.seat === seat);
          die.visible = true;
          if (ceremony.rolling && ceremony.contenders.includes(roll?.name)) {
            const rollElapsed = (performance.now() - ceremony.startedAt) / 1000;
            const phase = ['東', '南', '西', '北'].indexOf(seat) * 1.17;
            die.rotation.set(
              rollElapsed * (10.5 + phase) + phase,
              rollElapsed * (13.2 + phase * 0.4),
              rollElapsed * (8.7 + phase * 0.6)
            );
            die.position.y = 0.8 + Math.abs(Math.sin(rollElapsed * 11 + phase)) * 0.58;
          } else if (roll) {
            const [x, y, z] = DICE_TOP_ROTATIONS[roll.dice] || DICE_TOP_ROTATIONS[1];
            const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
            die.quaternion.slerp(target, 0.22);
            die.position.y += (0.8 - die.position.y) * 0.22;
          } else {
            die.position.y = 0.8;
          }
        });
      }
      cloudMeshes.forEach((cloud) => {
        cloud.position.x = cloud.userData.origin.x + Math.sin(elapsed * 0.22 + cloud.userData.phase) * 0.12;
        cloud.position.z = cloud.userData.origin.z + Math.cos(elapsed * 0.25 + cloud.userData.phase) * 0.12;
        cloud.material.opacity = 0.16 + (Math.sin(elapsed * 0.7 + cloud.userData.phase) + 1) * 0.045;
      });
      tileGroup.children.forEach((mesh) => {
        if (mesh.userData.handTileId) {
          const isSelected = selectedTileIdRef.current === mesh.userData.handTileId;
          const currentAction = actionEventRef.current;
          const isDrawn = currentAction?.type === 'draw' && currentAction.tile?.id === mesh.userData.handTileId;
          const targetY = mesh.userData.baseY + (isSelected ? 0.46 : isDrawn ? 0.18 : 0);
          mesh.position.y += (targetY - mesh.position.y) * 0.24;
          const faceMaterial = mesh.material[2];
          const isRecommended = suggestedTileIdRef.current === mesh.userData.handTileId;
          if (faceMaterial?.emissive) {
            faceMaterial.emissive.set(isSelected ? '#41c9b5' : isRecommended ? '#d5a92e' : '#000000');
            faceMaterial.emissiveIntensity = isSelected ? 0.3 : isRecommended ? 0.2 : 0;
          }
        }
        if (mesh.userData.dropStartedAt) {
          const progress = Math.min(1, (performance.now() - mesh.userData.dropStartedAt) / 430);
          mesh.position.y = 0.66 + 1.34 * (1 - progress) * (1 - progress);
          if (progress === 1) delete mesh.userData.dropStartedAt;
        }
      });
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      rebuildRef.current = null;
      clearTiles();
      tileTextures.forEach((texture) => texture?.dispose());
      tileGeometry.dispose();
      diceTextures.forEach((texture) => texture?.dispose());
      backTexture.dispose();
      cloudGeometry.dispose();
      wallGeometry.dispose();
      wallTop.dispose();
      wallSide.dispose();
      cloudMeshes.forEach((cloud) => cloud.material.dispose());
      scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    rebuildRef.current?.(game, playerName);
  }, [game, playerName, diceCeremony]);

  return <div className="mahjong-3d-canvas" ref={hostRef} aria-label="可旋转的三维麻将桌" />;
}
