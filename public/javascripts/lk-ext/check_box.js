ButtonMorph.subclass("CheckBoxMorph", {
  initialize: function($super, extent, m) {
    if (extent == null) {extent = pt(15,15);}
    this.checkedMorph = m || this.createXShapedMorph(extent);
    this.checkedMorph.handlesMouseDown = function() { return true; };
    this.checkedMorph.relayMouseEvents(this, {onMouseDown: "onMouseDown", onMouseMove: "onMouseMove", onMouseUp: "onMouseUp"});
    $super(pt(0,0).extent(extent));
    this.setFill(Color.white);
    var model = new BooleanHolder();
    this.connectModel({model: model, getValue: "isChecked", setValue: "setChecked"});
    this.notifier = model.notifier;

    this.updateView("all", null);
    return this;
  },

  toggle: true,

  createXShapedMorph: function(extent) {
    var x = createLabel("X", pt(0,0), extent);
    // aaa: No longer works now that we've upgraded LK: x.setInset(pt(4,1));
    return x;
  },

  isChecked: function() {return this.getModel().getValue();},
  setChecked: function(b) {return this.getModel().setValue(b);},

  toggleCheckBoxAppearance: function(v) {
    if (v) {
      if (this.checkedMorph.owner !== this) {
        this.addMorph(this.checkedMorph);
      }
    } else {
      if (this.checkedMorph.owner == this) {
        this.removeMorph(this.checkedMorph);
      }
    }
  },

  changeAppearanceFor: function(v) {
    this.toggleCheckBoxAppearance(v);
  }
});
