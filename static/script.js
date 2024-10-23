"use strict";

import { LETTERS } from "./letters.js";

/**
 * @typedef {Object} Offset
 * @property {number} x - The x coordinate offset
 * @property {number} y - The y coordinate offset
 */

/**
 * @typedef {Object.<string, Offset>} OriginOffsets
 */

class GOLCanvas {
  /**
   * @constructor
   */
  constructor() {
    this.canvas = document.querySelector("#canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.dpr = window.devicePixelRatio || 1;
    this.rect = this.canvas.getBoundingClientRect();
    this.imageDataCache = null;
    this.isAnimating = false;
    this.gridState = {}; // Stores the state of the grid (1 for live, 0 for dead)
    this.intervalId = null; // For GOL animation interval
    this.cellSize = null; // Fixed cell size for the simulation
    /** @type {OriginOffsets} */
    this.originOffsets = {}; // Offset for grid expansion

    this.initState();
    this.addEventListeners();
  }

  initState() {
    document.querySelectorAll(".gol-header").forEach((header) => {
      header.style.visibility = "visible";
    });
    this.rect = this.canvas.getBoundingClientRect();

    // Set the canvas size in pixels
    this.canvas.width = this.rect.width * this.dpr;
    this.canvas.height = this.rect.height * this.dpr;

    // Set the display size
    this.canvas.style.width = `${this.rect.width}px`;
    this.canvas.style.height = `${this.rect.height}px`;

    // Scale the context to handle DPR
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.imageSmoothingEnabled = false;

    // Calculate and initialize the grid state
    this.initializeGridState();

    if (!this.isAnimating) {
      this.isAnimating = true;
      this.animateCanvas();
    }
  }

  /** Get the grid offset for the given grid ID
   * @param {string} gridId - The ID of the grid
   * @returns {Object} - The grid offset object
   * */
  getGridOffsetForGridId(gridId) {
    if (!this.originOffsets[gridId]) {
      this.originOffsets[gridId] = { x: 0, y: 0 };
    }

    return this.originOffsets[gridId];
  }

  addEventListeners() {
    document.body.addEventListener("click", () => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
        console.log("Stopped GOL Simulation");
      } else {
        this.startGOLSimulation();
        console.log("Started GOL Simulation");
      }
    });
  }

  initializeGridState() {
    this.gridState = {};
    this.originOffsets = {};
    const golHeaders = document.querySelectorAll(".gol-header");

    for (let header of golHeaders) {
      this.initializeGridStateForElement(header);
    }
  }

  initializeGridStateForElement(targetEl) {
    const targetRect = targetEl.getBoundingClientRect();
    const targetHeight = targetRect.height;

    const gridHeight = 11; // Target number of vertical cells
    this.cellSize = Math.max(
      1,
      Math.floor((targetHeight / gridHeight) * this.dpr),
    ); // Fixed cell size, ensure it's at least 1

    // Calculate grid width based on the word from targetEl
    const word = targetEl.innerText.trim();
    let totalWidthCells = 0;
    for (let letter of word) {
      if (LETTERS[letter]) {
        totalWidthCells += LETTERS[letter][0].length + 1; // Letter width + 1 cell for space between letters
      } else {
        totalWidthCells += 4; // Add 3+1 cell for unknown characters
      }
    }
    totalWidthCells = Math.max(1, totalWidthCells - 1); // Remove extra space after the last letter, ensure width is at least 1

    const gridWidth = totalWidthCells; // Number of cells horizontally

    const gridState = Array.from({ length: gridHeight }, () =>
      Array(gridWidth).fill(0),
    );

    this.gridState[targetEl.id] = gridState;
    // Add the letters to the grid state
    this.addLettersToGridState(word, gridState);

    // Finally hide the original element
    targetEl.style.visibility = "hidden";
  }

  addLettersToGridState(word, gridState) {
    let startX = 0; // Start from column 0 to align letters to the very left side
    let startY = 3; // Start from row 3 to leave empty rows at the top

    for (let letter of word) {
      if (LETTERS[letter]) {
        const letterMatrix = LETTERS[letter];
        for (let row = 0; row < letterMatrix.length; row++) {
          for (let col = 0; col < letterMatrix[row].length; col++) {
            if (letterMatrix[row][col] === 1) {
              if (
                startY + row < gridState.length &&
                startX + col < gridState[0].length
              ) {
                gridState[startY + row][startX + col] = 1; // Set live cells for letters
              }
            }
          }
        }
        startX += LETTERS[letter][0].length + 1; // Move to the next letter position, with 1 column gap
      } else {
        console.warn(`Character not found in font: ${letter}`);
        startX += 4; // Move 3+1 columns for unknown characters
      }
    }
  }

  startGOLSimulation() {
    this.intervalId = setInterval(() => {
      // this.markOffScreenCellsAsDead();
      this.expandGridIfNecessary();
      this.computeNextState();
    }, 100);
  }

  expandGridIfNecessary() {
    for (let gridId in this.gridState) {
      this.expandGridForElement(gridId);
    }
  }

  expandGridForElement(gridId) {
    // Check if any live cells are on the edge, and expand the grid accordingly
    let expandTop = false,
      expandBottom = false,
      expandLeft = false,
      expandRight = false;
    let gridState = this.gridState[gridId];
    let originOffset = { ...this.getGridOffsetForGridId(gridId) };

    for (let row = 0; row < gridState.length; row++) {
      if (gridState[row][0] === 1) expandLeft = true;
      if (gridState[row][gridState[row].length - 1] === 1) expandRight = true;
    }

    for (let col = 0; col < gridState[0].length; col++) {
      if (gridState[0][col] === 1) expandTop = true;
      if (gridState[gridState.length - 1][col] === 1) expandBottom = true;
    }

    if (expandTop) {
      gridState.unshift(Array(gridState[0].length).fill(0));
      originOffset.y += 1;
    }
    if (expandBottom) {
      gridState.push(Array(gridState[0].length).fill(0));
    }
    if (expandLeft) {
      for (let row = 0; row < gridState.length; row++) {
        gridState[row].unshift(0);
      }
      originOffset.x += 1;
    }
    if (expandRight) {
      for (let row = 0; row < gridState.length; row++) {
        gridState[row].push(0);
      }
    }

    this.originOffsets[gridId] = originOffset;

    // Invalidate cache
    this.invalidateImageDataCache();
  }

  markOffScreenCellsAsDead() {
    // @TODO: Implement this function to mark off
    // cells that are off the screen as dead
    // Invalidate cache
    this.invalidateImageDataCache();
  }

  computeNextState() {
    for (let gridId in this.gridState) {
      this.computeElementNextState(gridId);
    }
    this.invalidateImageDataCache();
  }

  computeElementNextState(gridId) {
    const gridState = this.gridState[gridId];
    let nextState = gridState.map((row) => [...row]);

    for (let row = 0; row < gridState.length; row++) {
      for (let col = 0; col < gridState[row].length; col++) {
        const liveNeighbors = this.countLiveNeighborsForGrid(gridId, row, col);

        if (gridState[row][col] === 1) {
          // Any live cell with fewer than 2 or more than 3 live neighbors dies
          if (liveNeighbors < 2 || liveNeighbors > 3) {
            nextState[row][col] = 0;
          }
        } else {
          // Any dead cell with exactly 3 live neighbors becomes alive
          if (liveNeighbors === 3) {
            nextState[row][col] = 1;
          }
        }
      }
    }

    // Update the grid state and redraw
    this.gridState[gridId] = nextState;
  }

  countLiveNeighborsForGrid(gridId, row, col) {
    const gridState = this.gridState[gridId];
    let liveNeighbors = 0;
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    for (let [dRow, dCol] of directions) {
      const newRow = row + dRow;
      const newCol = col + dCol;

      if (
        newRow >= 0 &&
        newRow < gridState.length &&
        newCol >= 0 &&
        newCol < gridState[0].length
      ) {
        liveNeighbors += gridState[newRow][newCol];
      }
    }

    return liveNeighbors;
  }

  getCanvasImageData() {
    if (!this.imageDataCache) {
      this.imageDataCache = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
    }
    return this.imageDataCache;
  }

  invalidateImageDataCache() {
    this.imageDataCache = null;
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.rect.width, this.rect.height);
  }

  animateCanvas() {
    if (!this.isAnimating) return;

    this.clearCanvas();
    this.tick();

    requestAnimationFrame(() => this.animateCanvas());
  }

  stopAnimation() {
    this.isAnimating = false;
  }

  tick() {
    this.drawStoredGrid();
  }

  drawStoredGrid(drawCoordinateGrid = false) {
    const golHeaders = document.querySelectorAll(".gol-header");

    const imageData = this.getCanvasImageData();
    const data = imageData.data;

    for (let header of golHeaders) {
      const gridState = this.gridState[header.id];
      // Get image data at the actual resolution
      this.drawGridForElement(header, drawCoordinateGrid, gridState, data);
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.invalidateImageDataCache();
  }

  drawGridForElement(targetEl, drawCoordinateGrid, gridState, data) {
    const targetRect = targetEl.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();

    // Convert target coordinates to canvas coordinates
    const canvasX = (targetRect.left - canvasRect.left) * this.dpr;
    const canvasY = (targetRect.top - canvasRect.top) * this.dpr;

    const gridHeight = gridState.length;
    const gridWidth = gridState[0].length;

    let originOffset = this.getGridOffsetForGridId(targetEl.id);

    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const baseX = Math.floor(
          canvasX + (col - originOffset.x) * this.cellSize,
        );
        const baseY = Math.floor(
          canvasY + (row - originOffset.y) * this.cellSize,
        );

        // Draw the grid cell
        for (let y = 0; y < this.cellSize; y++) {
          for (let x = 0; x < this.cellSize; x++) {
            const pixelX = baseX + x;
            const pixelY = baseY + y;

            if (
              pixelX >= 0 &&
              pixelY >= 0 &&
              pixelX < this.canvas.width &&
              pixelY < this.canvas.height
            ) {
              const i = (pixelX + pixelY * this.canvas.width) * 4;

              // Set cell color based on state: Green for grid lines, White for live cells, and Transparent for dead cells
              if (gridState[row][col] === 1) {
                data[i] = 201; // R
                data[i + 1] = 201; // G
                data[i + 2] = 201; // B
                data[i + 3] = 255; // A
              } else if (
                drawCoordinateGrid &&
                (x % this.cellSize === 0 || y % this.cellSize === 0)
              ) {
                data[i] = 0; // R
                data[i + 1] = 255; // G
                data[i + 2] = 0; // B
                data[i + 3] = 128; // A (Semi-transparent green for grid lines)
              } else {
                data[i + 3] = 0; // Make the cell transparent
              }
            }
          }
        }
      }
    }

    this.originOffsets[targetEl.id] = { ...originOffset };
  }
}

let golCanvas;

// this trick visually relies on micro5 webfont
document.fonts.ready.then(() => {
  golCanvas = new GOLCanvas();
});

// Handle resize events on the window
window.addEventListener("resize", () => {
  if (golCanvas) {
    golCanvas.initState();
  }
});
