import React, { useState, useRef, useCallback, useEffect } from 'react';

// Structure data - dimensions are [width, height] in tiles
// Edit this object to add/modify structures
const STRUCTURES = {
  hull: {
    name: "Hull & Walls",
    color: "#3a4a5c",
    items: {
      hull: { name: "Hull Tile", size: [1, 1], color: "#4a5a6c" },
      wall: { name: "X1 Wall", size: [1, 1], color: "#5a6a7c" },
      door_x1: { name: "X1 Door", size: [1, 1], color: "#6a8a9c" },
      door_x2: { name: "X2 Door", size: [2, 1], color: "#6a8a9c" },
      spacesuit_door: { name: "Spacesuit Door", size: [1, 1], color: "#7a9aac" },
      window_2: { name: "Window 2-tile", size: [2, 1], color: "#8ab4cc" },
      window_3: { name: "Window 3-tile", size: [3, 1], color: "#8ab4cc" },
      window_4: { name: "Window 4-tile", size: [4, 1], color: "#8ab4cc" },
    }
  },
  power: {
    name: "Power",
    color: "#cc8844",
    items: {
      system_core_x1: { name: "System Core X1", size: [2, 3], color: "#ffaa44" },
      system_core_x2: { name: "System Core X2", size: [3, 3], color: "#ffaa44" },
      system_core_x3: { name: "System Core X3", size: [4, 3], color: "#ffaa44" },
      power_gen_x1: { name: "X1 Power Generator", size: [2, 2], color: "#dd9944" },
      power_gen_x2: { name: "X2 Power Generator", size: [3, 2], color: "#dd9944" },
      power_gen_x3: { name: "X3 Power Generator", size: [4, 3], color: "#dd9944" },
      energium_gen: { name: "Energium Generator", size: [2, 2], color: "#cc8833" },
      power_node_small: { name: "Small Power Node", size: [1, 1], color: "#bb7722" },
      power_node_large: { name: "Large Power Node", size: [2, 1], color: "#bb7722" },
      power_capacity: { name: "Power Capacity Node", size: [2, 2], color: "#aa6622" },
      backup_power: { name: "Backup Power Node", size: [2, 2], color: "#996622" },
      solar_panel: { name: "Solar Panel", size: [3, 2], color: "#4488cc" },
      power_conduit: { name: "Power Conduit", size: [1, 1], color: "#bb7722" },
    }
  },
  life_support: {
    name: "Life Support",
    color: "#44aa88",
    items: {
      oxygen_gen: { name: "Oxygen Generator", size: [2, 2], color: "#44ccaa" },
      gas_scrubber: { name: "Gas Scrubber", size: [2, 2], color: "#55bbaa" },
      thermal_reg: { name: "Thermal Regulator", size: [2, 2], color: "#ff6644" },
      wall_thermal: { name: "Wall Thermal Regulator", size: [1, 2], color: "#ff7755" },
      air_vent: { name: "Air Vent", size: [1, 1], color: "#66ccbb" },
    }
  },
  system: {
    name: "Systems & Combat",
    color: "#cc4444",
    items: {
      hyperdrive: { name: "Hyperdrive", size: [4, 5], color: "#4466cc" },
      hyperium_drive: { name: "Hyperium Hyperdrive", size: [4, 5], color: "#5577dd" },
      hull_stabilizer: { name: "Hull Stabilizer", size: [3, 2], color: "#6688cc" },
      nav_console: { name: "Navigation Console", size: [2, 2], color: "#5588bb" },
      ops_console: { name: "Operations Console", size: [2, 2], color: "#5588bb" },
      weapons_console: { name: "Weapons Console", size: [2, 2], color: "#cc5555" },
      shields_console: { name: "Shields Console", size: [2, 2], color: "#55aacc" },
      scanner: { name: "Scanner", size: [2, 2], color: "#66bb88" },
      shield_gen: { name: "Shield Generator", size: [3, 3], color: "#55ccdd" },
      shield_gen_small: { name: "Small Shield Generator", size: [2, 2], color: "#55ccdd" },
      energy_turret: { name: "Energy Turret", size: [3, 3], color: "#dd6655" },
      rocket_turret: { name: "Rocket Turret", size: [3, 3], color: "#cc5544" },
      autoturret: { name: "Autoturret", size: [2, 2], color: "#bb4433" },
      point_defense: { name: "Point Defense Turret", size: [2, 2], color: "#aa4433" },
      targeting_jammer: { name: "Targeting Jammer", size: [2, 2], color: "#9966cc" },
    }
  },
  airlock: {
    name: "Airlock & Hangar",
    color: "#8866aa",
    items: {
      airlock_x1: { name: "X1 Airlock", size: [4, 3], color: "#9977bb" },
      pod_hangar: { name: "Pod Hangar", size: [6, 5], color: "#8866aa" },
      shuttle_hangar: { name: "Shuttle Hangar", size: [8, 6], color: "#7755aa" },
      spacesuit_locker: { name: "Space Suit Locker", size: [2, 1], color: "#aa88cc" },
    }
  },
  storage: {
    name: "Storage",
    color: "#888866",
    items: {
      storage_small: { name: "Small Storage", size: [2, 2], color: "#999977" },
      storage_large: { name: "Large Storage", size: [3, 2], color: "#aaaaaa88" },
      smuggler_storage: { name: "Smuggler Storage", size: [2, 2], color: "#777766" },
      body_storage: { name: "Body Storage", size: [2, 2], color: "#665555" },
      robot_storage: { name: "Robot Storage", size: [2, 2], color: "#556666" },
      cargo_port: { name: "Cargo Port", size: [3, 2], color: "#888877" },
      asteroid_cargo: { name: "Asteroid Cargo Port", size: [3, 2], color: "#887766" },
    }
  },
  food: {
    name: "Food & Agriculture",
    color: "#66aa44",
    items: {
      kitchen: { name: "Kitchen", size: [3, 2], color: "#77bb55" },
      algae_dispenser: { name: "Algae Dispenser", size: [2, 2], color: "#55aa66" },
      grow_bed_small: { name: "Grow Bed Small", size: [3, 3], color: "#66cc55" },
      grow_bed_medium: { name: "Grow Bed Medium", size: [4, 3], color: "#66cc55" },
      grow_bed_large: { name: "Grow Bed Large", size: [5, 4], color: "#66cc55" },
      co2_producer: { name: "CO2 Producer", size: [2, 2], color: "#88aa66" },
      autopsy_table: { name: "Autopsy Table", size: [2, 2], color: "#996666" },
      alcohol_machine: { name: "Alcohol Beverage Machine", size: [2, 2], color: "#aa8855" },
    }
  },
  resource: {
    name: "Resource & Industry",
    color: "#aa8844",
    items: {
      recycler: { name: "Recycler", size: [3, 3], color: "#bb9955" },
      assembler: { name: "Assembler", size: [3, 3], color: "#cc9944" },
      advanced_assembler: { name: "Advanced Assembler", size: [3, 3], color: "#ddaa55" },
      metal_refinery: { name: "Metal Refinery", size: [3, 3], color: "#aa7744" },
      chemical_refinery: { name: "Chemical Refinery", size: [3, 3], color: "#88aa55" },
      energy_refinery: { name: "Energy Refinery", size: [3, 3], color: "#ccaa44" },
      optronics_fab: { name: "Optronics Fabricator", size: [3, 3], color: "#55aacc" },
      micro_weaver: { name: "Micro-Weaver", size: [3, 2], color: "#aa88aa" },
      item_fabricator: { name: "Item Fabricator", size: [3, 2], color: "#9988aa" },
      item_workbench: { name: "Item Workbench", size: [2, 2], color: "#887799" },
      tools_facility: { name: "Tools Facility", size: [2, 2], color: "#778899" },
      water_purifier: { name: "Water Purifier", size: [2, 2], color: "#4488bb" },
      water_collector: { name: "Water Collector", size: [2, 2], color: "#55aacc" },
      composter: { name: "Composter", size: [2, 2], color: "#775533" },
      ore_processor: { name: "Ore Processor", size: [3, 3], color: "#886644" },
    }
  },
  facility: {
    name: "Crew Facilities",
    color: "#6688aa",
    items: {
      bed: { name: "Bed", size: [1, 2], color: "#7799bb" },
      bunk_bed: { name: "Bunk Bed", size: [1, 2], color: "#6688aa" },
      bedside_table: { name: "Bedside Table", size: [1, 1], color: "#886644" },
      toilet: { name: "X1 Toilet", size: [2, 2], color: "#aabbcc" },
      medical_bed: { name: "Medical Bed", size: [2, 2], color: "#ccddee" },
      advanced_medical: { name: "Advanced Medical Bed", size: [3, 2], color: "#ddeeff" },
      medical_cabinet: { name: "Medical Cabinet", size: [1, 2], color: "#bbccdd" },
      research_lab: { name: "Research Lab", size: [3, 2], color: "#aabbdd" },
      research_bench: { name: "Research Workbench", size: [2, 2], color: "#99aacc" },
      learning_computer: { name: "Learning Computer", size: [2, 2], color: "#88aacc" },
      advanced_learning: { name: "Advanced Learning System", size: [3, 2], color: "#77aadd" },
      hypersleep: { name: "Hypersleep Chamber", size: [2, 3], color: "#55ccee" },
      hypersleep_x2: { name: "X2 Hypersleep Tank", size: [3, 3], color: "#44bbdd" },
      arcade: { name: "Arcade Machine", size: [2, 2], color: "#ff88aa" },
      jukebox: { name: "Jukebox", size: [2, 2], color: "#ffaa88" },
      personal_entertainment: { name: "Personal Entertainment", size: [1, 1], color: "#ee99aa" },
      surgical_facility: { name: "Surgical Enhancement", size: [3, 2], color: "#99bbcc" },
      enslavement: { name: "Enslavement Facility", size: [2, 2], color: "#554444" },
    }
  },
  robots: {
    name: "Robots",
    color: "#55aaaa",
    items: {
      salvage_station: { name: "Salvage Robot Station", size: [2, 2], color: "#66bbbb" },
      logistics_station: { name: "Logistics Robot Station", size: [2, 2], color: "#77cccc" },
      robot_workbench: { name: "Robot Workbench", size: [2, 2], color: "#55aaaa" },
    }
  },
  furniture: {
    name: "Furniture & Decoration",
    color: "#aa8877",
    items: {
      chair: { name: "X1 Chair", size: [1, 1], color: "#bb9988" },
      couch: { name: "X1 Couch", size: [2, 1], color: "#aa8877" },
      table_small: { name: "X1 Table Small", size: [2, 1], color: "#997766" },
      table_medium: { name: "X1 Table Medium", size: [3, 1], color: "#997766" },
      table_large: { name: "X1 Table Large", size: [4, 1], color: "#997766" },
      cover_object: { name: "Cover Object", size: [1, 1], color: "#666655" },
      light: { name: "Light", size: [1, 1], color: "#ffee88" },
      wall_light: { name: "Wall Light", size: [1, 1], color: "#ffdd77" },
      floor_light: { name: "In-floor Light", size: [1, 1], color: "#ffcc66" },
      plant_small: { name: "Decorative Plant", size: [1, 1], color: "#55aa55" },
      green_wall: { name: "Green Wall", size: [1, 2], color: "#44aa44" },
      deco_screen: { name: "Decorative Screen", size: [2, 1], color: "#6699bb" },
      deco_object: { name: "Decorative Object", size: [1, 1], color: "#aa8899" },
      holy_cow: { name: "Decorative Holy Cow", size: [1, 1], color: "#ffddaa" },
    }
  }
};

// Grid sizes for ship canvases
const GRID_PRESETS = {
  "1x1": { width: 27, height: 27 },
  "2x1": { width: 54, height: 27 },
  "1x2": { width: 27, height: 54 },
  "2x2": { width: 54, height: 54 },
  "3x1": { width: 81, height: 27 },
  "1x3": { width: 27, height: 81 },
  "3x2": { width: 81, height: 54 },
  "2x3": { width: 54, height: 81 },
};

const LAYERS = ["Hull", "Rooms", "Systems", "Furniture"];

export default function SpaceHavenPlanner() {
  const [gridSize, setGridSize] = useState(GRID_PRESETS["2x2"]);
  const [selectedPreset, setSelectedPreset] = useState("2x2");
  const [zoom, setZoom] = useState(12);
  const [placedStructures, setPlacedStructures] = useState([]);
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [activeLayer, setActiveLayer] = useState("Hull");
  const [visibleLayers, setVisibleLayers] = useState(new Set(LAYERS));
  const [expandedCategories, setExpandedCategories] = useState(new Set(["hull"]));
  const [hoveredCell, setHoveredCell] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tool, setTool] = useState("place"); // place, erase, move
  const [showGrid, setShowGrid] = useState(true);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Handle grid preset change
  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    setGridSize(GRID_PRESETS[preset]);
  };

  // Toggle category expansion
  const toggleCategory = (catKey) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(catKey)) {
      newExpanded.delete(catKey);
    } else {
      newExpanded.add(catKey);
    }
    setExpandedCategories(newExpanded);
  };

  // Toggle layer visibility
  const toggleLayerVisibility = (layer) => {
    const newVisible = new Set(visibleLayers);
    if (newVisible.has(layer)) {
      newVisible.delete(layer);
    } else {
      newVisible.add(layer);
    }
    setVisibleLayers(newVisible);
  };

  // Get structure info by key
  const getStructureInfo = (catKey, itemKey) => {
    return STRUCTURES[catKey]?.items[itemKey];
  };

  // Check if placement is valid
  const canPlace = (x, y, width, height, excludeId = null) => {
    if (x < 0 || y < 0 || x + width > gridSize.width || y + height > gridSize.height) {
      return false;
    }
    for (const struct of placedStructures) {
      if (excludeId && struct.id === excludeId) continue;
      const info = getStructureInfo(struct.category, struct.item);
      if (!info) continue;
      const [sw, sh] = info.size;
      if (!(x + width <= struct.x || x >= struct.x + sw ||
            y + height <= struct.y || y >= struct.y + sh)) {
        return false;
      }
    }
    return true;
  };

  // Place structure
  const placeStructure = (x, y) => {
    if (!selectedStructure || tool !== "place") return;
    const info = getStructureInfo(selectedStructure.category, selectedStructure.item);
    if (!info) return;
    const [width, height] = info.size;
    if (!canPlace(x, y, width, height)) return;
    
    const newStruct = {
      id: Date.now() + Math.random(),
      category: selectedStructure.category,
      item: selectedStructure.item,
      x,
      y,
      layer: activeLayer,
    };
    setPlacedStructures([...placedStructures, newStruct]);
  };

  // Erase structure at position
  const eraseAt = (x, y) => {
    setPlacedStructures(placedStructures.filter(struct => {
      const info = getStructureInfo(struct.category, struct.item);
      if (!info) return true;
      const [sw, sh] = info.size;
      return !(x >= struct.x && x < struct.x + sw && y >= struct.y && y < struct.y + sh);
    }));
  };

  // Handle canvas click
  const handleCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    
    if (tool === "place") {
      placeStructure(x, y);
    } else if (tool === "erase") {
      eraseAt(x, y);
    }
  };

  // Handle mouse move for preview
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    setHoveredCell({ x, y });
    
    if (isDragging) {
      if (tool === "place") {
        placeStructure(x, y);
      } else if (tool === "erase") {
        eraseAt(x, y);
      }
    }
  };

  // Export as PNG
  const exportPNG = () => {
    const canvas = document.createElement('canvas');
    const scale = 20;
    canvas.width = gridSize.width * scale;
    canvas.height = gridSize.height * scale;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#1a1e24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid
    ctx.strokeStyle = '#2a3040';
    ctx.lineWidth = 1;
    for (let x = 0; x <= gridSize.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= gridSize.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(canvas.width, y * scale);
      ctx.stroke();
    }
    
    // Structures
    for (const struct of placedStructures) {
      if (!visibleLayers.has(struct.layer)) continue;
      const info = getStructureInfo(struct.category, struct.item);
      if (!info) continue;
      const [sw, sh] = info.size;
      
      ctx.fillStyle = info.color;
      ctx.fillRect(struct.x * scale + 1, struct.y * scale + 1, sw * scale - 2, sh * scale - 2);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = info.name.substring(0, Math.floor(sw * 2));
      ctx.fillText(text, (struct.x + sw / 2) * scale, (struct.y + sh / 2) * scale);
    }
    
    const link = document.createElement('a');
    link.download = 'spacehaven-ship.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  // Save as JSON
  const saveJSON = () => {
    const data = {
      version: 1,
      gridSize,
      preset: selectedPreset,
      structures: placedStructures,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'spacehaven-ship.json';
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  // Load from JSON
  const loadJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.gridSize) setGridSize(data.gridSize);
        if (data.preset) setSelectedPreset(data.preset);
        if (data.structures) setPlacedStructures(data.structures);
      } catch (err) {
        alert('Failed to load file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Clear all
  const clearAll = () => {
    if (confirm('Clear all placed structures?')) {
      setPlacedStructures([]);
    }
  };

  // Render preview ghost
  const renderPreview = () => {
    if (!selectedStructure || !hoveredCell || tool !== "place") return null;
    const info = getStructureInfo(selectedStructure.category, selectedStructure.item);
    if (!info) return null;
    const [width, height] = info.size;
    const valid = canPlace(hoveredCell.x, hoveredCell.y, width, height);
    
    return (
      <div
        style={{
          position: 'absolute',
          left: hoveredCell.x * zoom,
          top: hoveredCell.y * zoom,
          width: width * zoom,
          height: height * zoom,
          backgroundColor: valid ? info.color + '88' : '#ff000066',
          border: `2px dashed ${valid ? '#88ff88' : '#ff4444'}`,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      />
    );
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#0d1117',
      color: '#c9d1d9',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      overflow: 'hidden',
    }}>
      {/* Left Panel - Structure Palette */}
      <div style={{
        width: '280px',
        backgroundColor: '#161b22',
        borderRight: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #30363d',
          background: 'linear-gradient(180deg, #1f2937 0%, #161b22 100%)',
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '2px',
            color: '#58a6ff',
            textTransform: 'uppercase',
          }}>
            🚀 Space Haven
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#8b949e' }}>
            Ship Planner v1.0
          </p>
        </div>
        
        {/* Structures List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {Object.entries(STRUCTURES).map(([catKey, category]) => (
            <div key={catKey} style={{ marginBottom: '4px' }}>
              <div
                onClick={() => toggleCategory(catKey)}
                style={{
                  padding: '8px 10px',
                  backgroundColor: expandedCategories.has(catKey) ? '#21262d' : 'transparent',
                  borderLeft: `3px solid ${category.color}`,
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderRadius: '0 4px 4px 0',
                }}
              >
                <span>{category.name}</span>
                <span style={{ color: '#6e7681', fontSize: '10px' }}>
                  {expandedCategories.has(catKey) ? '▼' : '▶'}
                </span>
              </div>
              {expandedCategories.has(catKey) && (
                <div style={{ padding: '4px 0 4px 12px' }}>
                  {Object.entries(category.items).map(([itemKey, item]) => (
                    <div
                      key={itemKey}
                      onClick={() => {
                        setSelectedStructure({ category: catKey, item: itemKey });
                        setTool("place");
                      }}
                      style={{
                        padding: '6px 8px',
                        marginBottom: '2px',
                        backgroundColor: selectedStructure?.category === catKey && 
                                        selectedStructure?.item === itemKey 
                                        ? '#238636' : '#21262d',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '10px',
                          height: '10px',
                          backgroundColor: item.color,
                          borderRadius: '2px',
                        }} />
                        {item.name}
                      </span>
                      <span style={{ color: '#6e7681', fontSize: '9px' }}>
                        {item.size[0]}×{item.size[1]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          padding: '10px 16px',
          backgroundColor: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          {/* Grid Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#8b949e' }}>Canvas:</span>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              style={{
                backgroundColor: '#21262d',
                color: '#c9d1d9',
                border: '1px solid #30363d',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              {Object.keys(GRID_PRESETS).map(p => (
                <option key={p} value={p}>{p} ({GRID_PRESETS[p].width}×{GRID_PRESETS[p].height})</option>
              ))}
            </select>
          </div>

          {/* Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#8b949e' }}>Zoom:</span>
            <input
              type="range"
              min="6"
              max="24"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value))}
              style={{ width: '80px' }}
            />
            <span style={{ fontSize: '10px', width: '28px' }}>{zoom}px</span>
          </div>

          {/* Tools */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'place', label: '✏️ Place', shortcut: 'P' },
              { id: 'erase', label: '🗑️ Erase', shortcut: 'E' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: tool === t.id ? '#238636' : '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            Grid
          </label>

          <div style={{ flex: 1 }} />

          {/* File Actions */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={saveJSON}
              style={{
                padding: '4px 10px',
                backgroundColor: '#21262d',
                color: '#58a6ff',
                border: '1px solid #30363d',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              💾 Save
            </button>
            <label style={{
              padding: '4px 10px',
              backgroundColor: '#21262d',
              color: '#58a6ff',
              border: '1px solid #30363d',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}>
              📂 Load
              <input
                type="file"
                accept=".json"
                onChange={loadJSON}
                style={{ display: 'none' }}
              />
            </label>
            <button
              onClick={exportPNG}
              style={{
                padding: '4px 10px',
                backgroundColor: '#21262d',
                color: '#3fb950',
                border: '1px solid #30363d',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              🖼️ Export PNG
            </button>
            <button
              onClick={clearAll}
              style={{
                padding: '4px 10px',
                backgroundColor: '#21262d',
                color: '#f85149',
                border: '1px solid #30363d',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: '#0d1117',
            padding: '20px',
          }}
        >
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => {
              setIsDragging(false);
              setHoveredCell(null);
            }}
            style={{
              position: 'relative',
              width: gridSize.width * zoom,
              height: gridSize.height * zoom,
              backgroundColor: '#1a1e24',
              backgroundImage: showGrid ? 
                `linear-gradient(#2a3040 1px, transparent 1px),
                 linear-gradient(90deg, #2a3040 1px, transparent 1px)` : 'none',
              backgroundSize: `${zoom}px ${zoom}px`,
              border: '2px solid #30363d',
              cursor: tool === 'erase' ? 'crosshair' : 'pointer',
              boxShadow: '0 0 40px rgba(88, 166, 255, 0.1)',
            }}
          >
            {/* Placed Structures */}
            {placedStructures.map(struct => {
              if (!visibleLayers.has(struct.layer)) return null;
              const info = getStructureInfo(struct.category, struct.item);
              if (!info) return null;
              const [sw, sh] = info.size;
              return (
                <div
                  key={struct.id}
                  style={{
                    position: 'absolute',
                    left: struct.x * zoom,
                    top: struct.y * zoom,
                    width: sw * zoom,
                    height: sh * zoom,
                    backgroundColor: info.color,
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.min(zoom * 0.6, 10) + 'px',
                    color: '#fff',
                    textShadow: '1px 1px 2px #000',
                    overflow: 'hidden',
                    textAlign: 'center',
                    padding: '2px',
                    lineHeight: 1.1,
                  }}
                >
                  {zoom >= 10 && info.name}
                </div>
              );
            })}
            
            {/* Preview Ghost */}
            {renderPreview()}
          </div>
        </div>

        {/* Status Bar */}
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#161b22',
          borderTop: '1px solid #30363d',
          fontSize: '11px',
          color: '#8b949e',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>
            {hoveredCell && `Cursor: ${hoveredCell.x}, ${hoveredCell.y}`}
            {!hoveredCell && 'Hover over grid to see coordinates'}
          </span>
          <span>
            Structures: {placedStructures.length} | 
            Layer: {activeLayer} | 
            Grid: {gridSize.width}×{gridSize.height}
          </span>
        </div>
      </div>

      {/* Right Panel - Layers */}
      <div style={{
        width: '200px',
        backgroundColor: '#161b22',
        borderLeft: '1px solid #30363d',
        padding: '16px',
      }}>
        <h3 style={{
          margin: '0 0 12px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Layers
        </h3>
        {LAYERS.map(layer => (
          <div
            key={layer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              marginBottom: '4px',
              backgroundColor: activeLayer === layer ? '#21262d' : 'transparent',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveLayer(layer)}
          >
            <input
              type="checkbox"
              checked={visibleLayers.has(layer)}
              onChange={() => toggleLayerVisibility(layer)}
              onClick={(e) => e.stopPropagation()}
            />
            <span style={{
              flex: 1,
              fontSize: '12px',
              fontWeight: activeLayer === layer ? 600 : 400,
            }}>
              {layer}
            </span>
          </div>
        ))}

        <div style={{ marginTop: '24px' }}>
          <h3 style={{
            margin: '0 0 12px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#8b949e',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Selected
          </h3>
          {selectedStructure ? (
            <div style={{
              padding: '12px',
              backgroundColor: '#21262d',
              borderRadius: '6px',
              fontSize: '11px',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                {getStructureInfo(selectedStructure.category, selectedStructure.item)?.name}
              </div>
              <div style={{ color: '#8b949e' }}>
                Size: {getStructureInfo(selectedStructure.category, selectedStructure.item)?.size.join('×')} tiles
              </div>
              <div style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: getStructureInfo(selectedStructure.category, selectedStructure.item)?.color,
                borderRadius: '4px',
                textAlign: 'center',
                color: '#fff',
                fontWeight: 600,
              }}>
                Preview
              </div>
            </div>
          ) : (
            <div style={{ color: '#6e7681', fontSize: '11px' }}>
              Select a structure from the palette
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px' }}>
          <h3 style={{
            margin: '0 0 8px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#8b949e',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Help
          </h3>
          <div style={{ fontSize: '10px', color: '#6e7681', lineHeight: 1.6 }}>
            <p>• Click structure to select</p>
            <p>• Click grid to place</p>
            <p>• Use Erase tool to remove</p>
            <p>• Save/Load as JSON</p>
            <p>• Export as PNG image</p>
          </div>
        </div>
      </div>
    </div>
  );
}
