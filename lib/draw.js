//draw.js
const DEFAULT_LINE_SLOPE = 0;
const DEFAULT_LINE_LENGTH = 100;
const DEFAULT_BOLT_COUNT = 1;
const DEFAULT_ANCHOR_SIZE = 15;
const DEFAULT_RAP_SLOPE = 90;
const DEFAULT_POOL_WIDTH = 50;
const DEFAULT_POOL_DEPTH = 50;
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_LINE_SHORTEN = false;

const VERT_SCALE = 1.0;

function quick_draw(raw) {
  config = jsyaml.load(raw);
  const drawInstance = new Draw(config);
  drawInstance.draw();
  document.getElementById("svg-preview").innerHTML = drawInstance.generateSVG();
}


class Draw {
  constructor(config) {
    this.start_x = 20;
    this.start_y = 0;

    // Pen Location Tracking
    this.current_x = this.start_x;
    this.current_y = this.start_y;

    this.svg_body = "";
    this.config = config;

    // Viewbox tracking
    this.min_x = this.start_x;
    this.min_y = this.start_y;
    this.max_x = this.start_x;
    this.max_y = this.start_y;
  }

  update_viewbox(x2, y2) {
    /*
    Viewbox size tracking sucks. In theory getBBox() should return the size of an element,
    but it only works in a DOM and only once the item is rendered. It's also computationally
    expensive. Instead we have track the boundary as things are added.
    */
    this.min_x = Math.min(this.min_x, x2, this.current_x);
    this.min_y = Math.min(this.min_y, y2, this.current_y);
    this.max_x = Math.max(this.max_x, x2, this.current_x);
    this.max_y = Math.max(this.max_y, y2, this.current_y);
  }

  draw() {
    this.config.features.forEach((feature, index) => {
      if (feature.hidden) {
        return; // skip feature flagged as hidden
      }
      this.current_index = index;
      switch (feature.type) {
        case "line":
          const slope = feature.slope || DEFAULT_LINE_SLOPE;
          const length = feature.length || DEFAULT_LINE_LENGTH;
          const shorten = feature.shorten || DEFAULT_LINE_SHORTEN;
          const label = feature.label || null;
          const traverse = feature.traverse || false;
          this.plot_line(length, slope, shorten, label, traverse);
          break;
        case "rap":
          this.plot_line(
            feature.length || DEFAULT_LINE_LENGTH,
            feature.slope || DEFAULT_RAP_SLOPE,
            false,
            feature.label || null
          );
          break;
        case "anchor":
          this.plot_anchor(feature.style, feature.count || DEFAULT_BOLT_COUNT);
          break;
        case "pool":
          this.plot_pool(
            feature.width || DEFAULT_POOL_WIDTH,
            feature.depth || DEFAULT_POOL_DEPTH,
            feature.label || null
          );
          break;
        case "exit":
          this.plot_exit(feature.label || null);
          break;
        case "break":
            this.current_x = this.start_x;
            this.current_y = this.start_y + 100;
          break;
        default:
          break;
      }
    });
  }

  plot_anchor(style, count) {
    const symbols = {
      bolt: "X",
      vthread: "V",
      natural: "N",
    };
    const size = DEFAULT_ANCHOR_SIZE;

    let text = "";
    const anchor_x = this.current_x;
    const anchor_y = this.current_y - size;

    text += symbols[style].repeat(count);
    this.svg_body += `
      <text 
        x="${anchor_x}" 
        y="${anchor_y}" 
        text-anchor="middle" 
        font-family="Arial" 
        font-size="${size}" 
        data-index="${this.current_index}" 
        fill="red">
          ${text}
      </text>\n`;
  }

  add_label(label, x_offset = 10, y_offset = -40) {
    const font_size = DEFAULT_FONT_SIZE;

    // We have to take a guess where the text will end
    let est_width = label.length * DEFAULT_FONT_SIZE * 0.6;

    this.svg_body += `
      <text 
        x="${(this.current_x + x_offset).toFixed(2)}" 
        y="${(this.current_y + y_offset).toFixed(2)}" 
        font-family="Arial" 
        font-size="${font_size}" 
        data-index="${this.current_index}"
        fill="black">
          ${label}
      </text>\n`;

    this.update_viewbox(
      this.current_x + x_offset + est_width,
      this.current_y + y_offset - font_size
    );
  }

  plot_line(
    length = 100,
    slope = 90,
    shorten = false,
    label = null,
    traverse = false
  ) {
    length *= VERT_SCALE;

    // Convert slope angle to radians
    const slope_radians = (slope * Math.PI) / 180;

    // Calculate the end coordinates (x2, y2)
    const x2 = this.current_x + length * Math.cos(slope_radians);
    const y2 = this.current_y + length * Math.sin(slope_radians);

    this.svg_body += `
    <line
      x1="${this.current_x}" y1="${this.current_y}"
      x2="${x2}" y2="${y2}"
      stroke="black"
      stroke-width="2"
      data-index="${this.current_index}"
    />
    `;


    this.update_viewbox(x2, y2);

    if (label) this.add_label(label);

    if (shorten) {
      const font_size = 30;
      const mid_x = (this.current_x + x2) / 2;
      const mid_y = (this.current_y + y2) / 2 + font_size / 2.5;
      this.svg_body += `
        <text 
          x="${mid_x}" 
          y="${mid_y}" 
          font-family="Arial" 
          font-size="${font_size}" 
          fill="black">
            //
        </text>\n`;
    }

    if (traverse) {
      let traverse_height_above_line = 10;
      let traverse_x_offset = 15;
      const mid_x = (this.current_x + x2) / 2;

      let dip = this.current_y - traverse_height_above_line / 2;

      this.svg_body += `
        <path 
          d="M ${this.current_x} ${this.current_y - traverse_height_above_line} 
             Q ${mid_x} ${dip}, ${x2}, ${y2 - traverse_height_above_line}" 
          stroke="black" 
          fill="transparent" 
        />\n`;
    }

    this.current_x = x2;
    this.current_y = y2;
  }

  plot_pool(width, depth, label = null) {
    const end_x = this.current_x + 2 * width;

    this.svg_body += `
      <path 
        d="M ${this.current_x},${this.current_y} 
           A ${width},${depth} 0 0 0 ${end_x},${this.current_y}" 
        fill="lightblue" 
        stroke="black" 
        stroke-width="2" 
        data-index="${this.current_index}" 
      />\n`;

    if (label) this.add_label(label);

    this.update_viewbox(end_x, this.current_y + depth);
    this.current_x = end_x;
  }

  plot_exit(label = null, offset_start = 5, offset_end = 50) {

    let start_x = this.current_x + offset_start;
    let start_y = this.current_y - offset_start;
    let end_x = this.current_x + offset_end;
    let end_y = this.current_y - offset_end;

    this.svg_body += `
      <defs>
        <marker 
          id="arrowhead" 
          markerWidth="10" 
          markerHeight="7" 
          refX="8" 
          refY="3.5" 
          orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="green"/>
        </marker>
      </defs>
      <line 
        x1="${start_x}"
        y1="${start_y}"
        x2="${end_x}" 
        y2="${end_y}" 
        stroke="green" 
        stroke-width="2" 
        marker-end="url(#arrowhead)" 
        data-index="${this.current_index}"
      />\n`;
    this.update_viewbox(end_x, end_y);
    if (label) this.add_label(label, offset_start, -offset_end - 10);
  }

  plot_info_box() {
    this.svg_body += `
  <text x="${this.max_x}" y="${this.min_y}" font-family="Arial" fill="black" text-anchor="end" dominant-baseline="hanging">
    <tspan font-size="60" x="${this.max_x}" dy="0">${this.config.canyon_name}</tspan>
    <tspan font-size="30" x="${this.max_x}" dy="70">${this.config.canyon_location}</tspan>
    <tspan font-size="25" x="${this.max_x}" dy="35">${this.config.canyon_grade}</tspan>
  </text>
  `;
  }

  generateSVG() {
    this.plot_info_box(); // Disabled until scaling fixed

    // Add padding to viewbox
    const padding = 30;
    this.max_x += padding;
    this.max_y += padding;
    this.min_x -= padding;
    this.min_y -= padding;

    const svg_width = this.max_x - this.min_x;
    const svg_height = this.max_y - this.min_y;

    const svg_header = `
      <svg xmlns="http://www.w3.org/2000/svg"
        viewBox="${this.min_x} ${this.min_y} ${svg_width} ${svg_height}"
        width="100%" height="100%"
      >\n`;
    const svg_footer = "</svg>";

    const body = `
      ${this.svg_body}
      <rect 
        id="border" 
        x="${this.min_x}" 
        y="${this.min_y}" 
        width="${svg_width}" 
        height="${svg_height}" 
        fill="none" 
        stroke="black" 
        stroke-width="1"
      />\n`;

    return svg_header + body + svg_footer;
  }
}
