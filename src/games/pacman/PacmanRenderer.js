import { DIRECTIONS } from './Maze.js';

export class PacmanRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.mapKey = '';
    this.tile = 24;
  }

  background(maze) {
    const key = maze.rows.join('\n');
    if (this.mapKey === key) return;
    this.mapKey = key;
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = maze.width * this.tile * ratio;
    this.canvas.height = maze.height * this.tile * ratio;
    this.ratio = ratio;
    this.layer = document.createElement('canvas');
    this.layer.width = this.canvas.width; this.layer.height = this.canvas.height;
    const ctx = this.layer.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#03030b'; ctx.fillRect(0, 0, maze.width * this.tile, maze.height * this.tile);
    const wall = (x, y) => ['#', '_'].includes(maze.rows[y]?.[x]);
    ctx.fillStyle = '#071127';
    ctx.strokeStyle = '#304aff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let y = 0; y < maze.height; y += 1) for (let x = 0; x < maze.width; x += 1) {
      if (!wall(x, y)) continue;
      const left = x * this.tile; const top = y * this.tile; const size = this.tile;
      ctx.fillRect(left, top, size, size);
      ctx.beginPath();
      if (!wall(x, y - 1)) { ctx.moveTo(left + (wall(x - 1, y) ? 0 : 2), top + 2); ctx.lineTo(left + size - (wall(x + 1, y) ? 0 : 2), top + 2); }
      if (!wall(x, y + 1)) { ctx.moveTo(left + (wall(x - 1, y) ? 0 : 2), top + size - 2); ctx.lineTo(left + size - (wall(x + 1, y) ? 0 : 2), top + size - 2); }
      if (!wall(x - 1, y)) { ctx.moveTo(left + 2, top + (wall(x, y - 1) ? 0 : 2)); ctx.lineTo(left + 2, top + size - (wall(x, y + 1) ? 0 : 2)); }
      if (!wall(x + 1, y)) { ctx.moveTo(left + size - 2, top + (wall(x, y - 1) ? 0 : 2)); ctx.lineTo(left + size - 2, top + size - (wall(x, y + 1) ? 0 : 2)); }
      ctx.stroke();
    }
    if (maze.door) {
      ctx.strokeStyle = '#ffb9ed'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(maze.door.x * this.tile, (maze.door.y + 0.5) * this.tile);
      ctx.lineTo((maze.door.x + 1) * this.tile, (maze.door.y + 0.5) * this.tile); ctx.stroke();
    }
  }

  cherry(ctx, x, y) {
    ctx.strokeStyle = '#66d354'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x + 2, y - 13, x + 5, y - 7);
    ctx.moveTo(x + 6, y + 2); ctx.quadraticCurveTo(x + 10, y - 11, x + 5, y - 7); ctx.stroke();
    for (const offset of [-5, 5]) {
      ctx.fillStyle = '#f42b4c'; ctx.beginPath(); ctx.arc(x + offset, y + (offset > 0 ? 3 : 0), 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb1c3'; ctx.fillRect(x + offset - 2, y - (offset > 0 ? 0 : 3), 2, 2);
    }
  }

  draw(match) {
    const { maze } = match;
    this.background(maze);
    const ctx = this.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.layer, 0, 0);
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    const time = match.activeMs;
    for (const [key, item] of maze.items) {
      const [x, y] = key.split(',').map(Number);
      const cx = (x + 0.5) * this.tile; const cy = (y + 0.5) * this.tile;
      if (item === 'F') { this.cherry(ctx, cx, cy); continue; }
      if (item === 'o' && Math.floor(time / 180) % 2 === 1) continue;
      ctx.fillStyle = item === 'o' ? '#ffe7b5' : '#ffcaa5';
      ctx.beginPath(); ctx.arc(cx, cy, item === 'o' ? 6 : 2, 0, Math.PI * 2); ctx.fill();
    }
    if (match.phase === 'level-clear' && Math.floor(time / 100) % 2) {
      ctx.fillStyle = 'rgba(100,130,255,.13)'; ctx.fillRect(0, 0, maze.width * this.tile, maze.height * this.tile);
    }
    for (const ghost of match.ghosts) this.characterCopies(ghost, maze, (x, y) => this.ghost(ctx, ghost, x, y, match));
    if (!(match.invulnerableMs > 0 && Math.floor(time / 90) % 2)) {
      this.characterCopies(match.player, maze, (x, y) => this.pacman(ctx, match, x, y));
    }
    if (match.popup) {
      ctx.fillStyle = '#7cfaff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
      ctx.fillText(match.popup.text, (match.popup.position.x + 0.5) * this.tile, (match.popup.position.y + 0.1) * this.tile);
    }
  }

  characterCopies(actor, maze, draw) {
    const position = actor.visualPosition(maze);
    draw((position.x + 0.5) * this.tile, (position.y + 0.5) * this.tile);
    if (position.x < 0.5) draw((position.x + maze.width + 0.5) * this.tile, (position.y + 0.5) * this.tile);
    if (position.x > maze.width - 1.5) draw((position.x - maze.width + 0.5) * this.tile, (position.y + 0.5) * this.tile);
  }

  pacman(ctx, match, x, y) {
    const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[match.player.direction];
    let mouth = match.player.destination ? 0.12 + Math.abs(Math.sin(match.activeMs / 70)) * 0.75 : 0.2;
    if (match.phase === 'dying') mouth = (1 - match.phaseMs / 900) * Math.PI;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#ffe600'; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, 10, mouth, Math.PI * 2 - mouth); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  ghost(ctx, ghost, x, y, match) {
    const frightened = match.powerMs > 0 && ghost.state === 'active';
    const flashing = frightened && match.powerMs < 1800 && Math.floor(match.activeMs / 160) % 2;
    if (ghost.state !== 'returning') {
      ctx.fillStyle = frightened ? flashing ? '#f5f2ef' : '#2549ec' : { BLINKY: '#ff3648', PINKY: '#ff9cda', INKY: '#4ce5ec', CLYDE: '#ffac48' }[ghost.name];
      ctx.beginPath(); ctx.moveTo(x - 10, y + 10); ctx.lineTo(x - 10, y);
      ctx.arc(x, y, 10, Math.PI, 0);
      ctx.lineTo(x + 10, y + 10);
      const offset = Math.floor(match.activeMs / 120) % 2;
      for (let index = 4; index >= 0; index -= 1) ctx.lineTo(x - 10 + index * 4, y + 7 + (index % 2 === offset ? 3 : 0));
      ctx.closePath(); ctx.fill();
    }
    if (frightened) {
      ctx.fillStyle = flashing ? '#e52a43' : '#fff7cf';
      ctx.fillRect(x - 5, y - 2, 3, 3); ctx.fillRect(x + 3, y - 2, 3, 3);
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i < 7; i += 1) { const px = x - 6 + i * 2; const py = y + 5 + i % 2 * 2; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
    } else {
      const direction = DIRECTIONS[ghost.direction];
      for (const offset of [-4.5, 4.5]) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + offset, y - 1, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1639c6'; ctx.beginPath(); ctx.arc(x + offset + direction.x * 1.6, y - 1 + direction.y * 2, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}
