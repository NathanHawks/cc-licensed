/*
  @author Nathan Hawks nhawks@gmail.com
  @version cc-1.0
  @license Creative Commons Attribution 4.0
      This file is released under the Creative Commons Attribution 4.0 license.
      For an overview of what this means, visit:
       https://creativecommons.org/licenses/by/4.0/
      To reference the entire license, visit:
       https://creativecommons.org/licenses/by/4.0/legalcode

  Calculates a 25-slice plane plus named meta-zones (see this.meta)
  Allows queries as to which zone and metazone(s) a coordinate falls into.

  API:
  .whichSlice(x, y) returns the numeric slice ID from 1 to 25 if x/y is valid
  .is(metaName, x, y) returns true if that coordinate is within that metazone

  Zones and metazones: the 25-slice scheme consists basically of a border and
  crosshair-gutter; like this (view using a monospace font):
  ______________________________________
  |___|_____________||_____________|___|   Zones  1- 5 (15% tall by default)
  |   |             ||             |   |
  |   |             ||             |   |   Zones  6-10 (34% tall by default)
  |   |             ||             |   |
  |===|=============[]=============|===|   Zones 11-15 ( 2% tall by default)
  |   |             ||             |   |
  |   |             ||             |   |   Zones 16-20 (34% tall by default)
  |___|_____________||_____________|___|
  |___|_____________||_____________|___|   Zones 21-25 (15% tall by default)

    ^      ^         ^     ^         ^
    `      `         `     `         `- Zones 5,10,15,20,25 (15% wide default)
    `      `         `     `
    `      `         `     `----------- Zones 4, 9,14,19,24 (34% wide default)
    `      `         `
    `      `         `----------------- Zones 3, 8,13,18,23 ( 2% wide default)
    `      `
    `      `--------------------------- Zones 2, 7,12,17,22 (34% wide default)
    `
    `---------------------------------- Zones 1, 6,11,16,21 (15% wide default)

  Every coordinate has a one-to-many relationship to metazones, specifically,
    every coordinate is in more than one metazone, e.g. everything is either in
    right, left, or v_mid; everything is either in top, bottom, or h_mid; but
    it's also in either a border/corner, one or both mid-lines, or one of the
    big quads

  (IMPORTANT NOTE: v_mid is the 2% wide *vertical line* down the middle;
        v_mid is NOT the vertical mid-line;
        likewise h_mid is the 2% tall *horizontal* line across the vertical mid;
        sorry, I saw no way to avoid ambiguity in naming those terms until after
        the system was in use.)

  The metazone names and their meanings:
   The biggest areas:
    left:          any pixel left of v_mid
    right:         any pixel right of v_mid
    bottom:        any pixel below h_mid
    top:           any pixel above h_mid
   The biggest single zones:
    lt_zone:       left-top main area;     any pixel in the  7th zone
    rt_zone:       right-top main area;    any pixel in the  9th zone
    lb_zone:       left-bottom main area;  any pixel in the 17th zone
    rb_zone:       right-bottom main area; any pixel in the 19th zone
   Borders and corners, mid-lines, and exact center
    l_border:      any pixel in the 1st column of zones
    v_mid:         any pixel in the 3rd column of zones (horizontal center line)
    r_border:      any pixel in the 5th column of zones
    t_border:      any pixel in the 1st row of zones
    h_mid:         any pixel in the 3rd row of zones (vertical center line)
    b_border:      any pixel in the 5th row of zones
    lt_corner:     left-top corner;     any pixel in the  1st zone
    rt_corner:     right-top corner;    any pixel in the  5th zone
    center:        exact center area;   any pixel in the 13th zone
    lb_corner:     left-bottom corner;  any pixel in the 21st zone
    rb_corner:     right-bottom corner; any pixel in the 25th zone
*/
class Slicer25 {
  constructor(arg={}) {
    this.init(arg);
  }
  whichSlice(xoffset, yoffset) {
    xoffset = Math.round(xoffset); yoffset = Math.round(yoffset);
    for (let i = 1; i < this.slices.length; i++) {
        if ( this.slices[i].xstart <= xoffset && this.slices[i].xstop >= xoffset
          && this.slices[i].ystart <= yoffset && this.slices[i].ystop >= yoffset
        )
          return i;
    }
  }
  getFallbackWidth() { return window.innerWidth; }
  getFallbackHeight() { return window.innerHeight; }
  init(arg) { // TODO: argless 3-stage fallback (engine, jquery, dom query)
    let w =(arg.hasOwnProperty('width')) ? arg.width : this.getFallbackWidth();
    let h =(arg.hasOwnProperty('height')) ?arg.height: this.getFallbackHeight();
    this.slices = [];           // raw array of (0-based) pixel offset ranges
    this.meta = {               // composite ranges
      left:{},right:{},bottom:{},top:{},
      l_border:{},r_border:{},b_border:{},t_border:{},
      lb_corner:{},rb_corner:{},lt_corner:{},rt_corner:{},
      lb_zone:{},rb_zone:{},lt_zone:{},rt_zone:{},
      center:{},h_mid:{},v_mid:{},
    }
    this.xsize = w;
    this.ysize = h;
    this.slices = this.sliceScreen();
    this.meta = this.buildMeta();
  }
  sliceScreen() {
    let p = {b:15,z:34,m:2}; // percent of dimension for zone types
    let sizes = [
      null, // 1-based array
      {x:p.b,y:p.b},{x:p.z,y:p.b},{x:p.m,y:p.b},{x:p.z,y:p.b},{x:p.b,y:p.b},
      {x:p.b,y:p.z},{x:p.z,y:p.z},{x:p.m,y:p.z},{x:p.z,y:p.z},{x:p.b,y:p.z},
      {x:p.b,y:p.m},{x:p.z,y:p.m},{x:p.m,y:p.m},{x:p.z,y:p.m},{x:p.b,y:p.m},
      {x:p.b,y:p.z},{x:p.z,y:p.z},{x:p.m,y:p.z},{x:p.z,y:p.z},{x:p.b,y:p.z},
      {x:p.b,y:p.b},{x:p.z,y:p.b},{x:p.m,y:p.b},{x:p.z,y:p.b},{x:p.b,y:p.b}
    ]
    let xoffset = lit.num.zero, yoffset = lit.num.zero;
    var ret = [null]; // 1-based array
    // loop sizes (1-based array)
    for (let i = lit.num.one; i < sizes.length; i++) {
      // get cell range
      ret[i] = this._getScreenRangeFromXYPercent(
        sizes[i].x, sizes[i].y, xoffset, yoffset
      );
      // prep offsets for next cell
      if (i % lit.num.five == lit.num.zero) {
        xoffset = lit.num.zero;
        yoffset = ret[i].ystop + lit.num.one;
      }
      else xoffset = ret[i].xstop + lit.num.one; // no change to yoffset
      if (ret[i].ystop == this.ysize) ret[i].ystop--;
    }
    // build meta-spaces
    return ret;
  }
  buildMeta() {
    let s = this.slices;
    let ret = {};
    ret.left = this._getMergedRange([s[1],s[2],s[6],s[7],s[11],s[12],s[16],s[17],s[21],s[22]]);
    ret.right = this._getMergedRange([s[4],s[5],s[9],s[10],s[14],s[15],s[19],s[20],s[24],s[25]]);
    ret.top = this._getMergedRange([s[1],s[2],s[3],s[4],s[5],s[6],s[7],s[8],s[9],s[10]]);
    ret.bottom = this._getMergedRange([s[16],s[17],s[18],s[19],s[20],s[21],s[22],s[23],s[24],s[25]]);
    ret.l_border = this._getMergedRange([s[1],s[6],s[11],s[16],s[21]]);
    ret.r_border = this._getMergedRange([s[5],s[10],s[15],s[20],s[25]]);
    ret.t_border = this._getMergedRange([s[1],s[2],s[3],s[4],s[5]]);
    ret.b_border = this._getMergedRange([s[21],s[22],s[23],s[24],s[25]]);
    ret.lt_corner = [s[1]];
    ret.rt_corner = [s[5]];
    ret.lb_corner = [s[21]];
    ret.rb_corner = [s[25]];
    ret.lt_zone = [s[7]];
    ret.rt_zone = [s[9]];
    ret.lb_zone = [s[17]];
    ret.rb_zone = [s[19]];
    ret.center = [s[13]];
    ret.h_mid = this._getMergedRange([s[15],s[16],s[17],s[18],s[19],s[20]]);
    ret.v_mid = this._getMergedRange([s[3],s[8],s[13],s[18],s[23]]);
    return ret;
  }
  is(metaName, x, y) {
    let r = this.meta[metaName];
    if (x >= r.xstart && x <= r.xstop && y >= r.ystart && y <= r.ystop)
      return true;
    else return false;
  }
  _getMergedRange(ranges) {
    let r = null;
    let minX = null, minY = null, maxX = null, maxY = null;
    for (let i = lit.num.zero; i < ranges.length; i++) {
      r = ranges[i];
      if (r.xstart < minX || minX === null) minX = r.xstart;
      if (r.xstop > maxX || maxX === null) maxX = r.xstop;
      if (r.ystart < minY || minY === null) minY = r.ystart;
      if (r.ystop > maxY || maxY === null) maxY = r.ystop;
    }
    return {xstart: minX, ystart: minY, xstop: maxX, ystop: maxY};
  }
  _getPercentOfScreenAsPixels(pct, whichDim) {
    let dim = (whichDim == lit.x) ? this.xsize : this.ysize;
    return dim * (pct/lit.num.onehundred);
  }
  _getScreenRangeFromXYPercent(xpct, ypct, xoffset, yoffset) {
    let xpx = Math.round(this._getPercentOfScreenAsPixels(xpct, lit.x));
    let ypx = Math.round(this._getPercentOfScreenAsPixels(ypct, lit.y));
    return {
      xstart: xoffset, xstop: xoffset+xpx-lit.num.one,
      ystart: yoffset, ystop: yoffset+ypx-lit.num.one
    }
  }
}
