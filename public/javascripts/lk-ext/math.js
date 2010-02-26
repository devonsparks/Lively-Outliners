Object.extend(Number.prototype, {
  closerToZeroBy: function(n) {
    if (this < 0) {
      return (this > -n) ? 0 : this + n;
    } else {
      return (this <  n) ? 0 : this - n;
    }
  },
});

Object.extend(Point.prototype, {
  closerToZeroBy: function(p) {
    return new Point(this.x.closerToZeroBy(p.x), this.y.closerToZeroBy(p.y));
  },

  unitVector: function() {
    var r = this.r();
    if (r == 0) {return null;}
    return this.scaleBy(1.0 / r);
  },

  scaleToLength: function(n) {
    return this.unitVector().scaleBy(n);
  },

  perpendicularVector: function() {
    return new Point(-this.y, this.x);
  },

  minMaxPt: function(pMin, pMax) {
    return new Point(Math.max(Math.min(this.x,pMin.x), pMax.x), Math.max(Math.min(this.y,pMin.y), pMax.y));
  },

  destructively_addXY: function(dx, dy) {this.x += dx; this.y += dy; return this;},
  destructively_addPt: function(p) {return this.destructively_addXY(p.x, p.y);},
  destructively_scaleBy: function(scale) {this.x *= scale; this.y *= scale; return this;},
  destructively_minPt: function(p) {this.x = Math.min(this.x,p.x); this.y = Math.min(this.y,p.y); return this;},
  destructively_maxPt: function(p) {this.x = Math.max(this.x,p.x); this.y = Math.max(this.y,p.y); return this;},
  destructively_closerToZeroBy: function(p) {this.x = this.x.closerToZeroBy(p.x); this.y = this.y.closerToZeroBy(p.y); return this;},

  // Optimization: don't create a new Point object in the process of calculating this.
  r: function() {
    var x = this.x;
    var y = this.y;
    return Math.sqrt(x*x + y*y);
  },
});

Object.extend(Rectangle.prototype, {
  area: function() {return this.width * this.height;},
});
