(function() {
    'use strict';

    var REG_CLASS_REPLACE = /(?:^|\s)(cke_imgresize[^\s]*)(?:\s|$)/g;

    CKEDITOR.plugins.add('imgresize', {
        modes: { 'wysiwyg': 1 },

        onLoad: function() {
            if (!CKEDITOR.env.webkit) {
                return;
            }

            CKEDITOR.addCss(
                '.cke_imgresize_wrapper > img::selection {color:rgba(0,0,0,0);}' +
                '.cke_imgresize_wrapper > img {outline:1px solid #000;border:none;}' +

                '.cke_imgresize_wrapper {position:relative;display:inline-block;outline:none;}' +
                '.cke_imgresize_controls > i {visibility:visible;position:absolute;display:block;width:5px;height:5px;background:#fff;border:1px solid #000;}' +
                '.cke_imgresize_controls > i.active, .cke_imgresize_controls > i:hover {background:#000;}' +
                '.cke_imgresize_br, .cke_imgresize_tl {cursor:nwse-resize;}' +
                '.cke_imgresize_bm, .cke_imgresize_tm {cursor:ns-resize;}' +
                '.cke_imgresize_bl, .cke_imgresize_tr {cursor:nesw-resize;}' +
                '.cke_imgresize_lm, .cke_imgresize_rm {cursor:ew-resize;}' +

                '.cke_imgresize_tl {top:-3px;left:-3px;}' +
                '.cke_imgresize_tm {top:-3px;left:50%;margin-left:-2px;}' +
                '.cke_imgresize_tr {top:-3px;right:-3px;}' +
                '.cke_imgresize_lm {top:50%;left:-3px;margin-top:-2px;}' +
                '.cke_imgresize_rm {top:50%;right:-3px;margin-top:-2px;}' +
                '.cke_imgresize_bl {bottom:-3px;left:-3px;}' +
                '.cke_imgresize_bm {bottom:-3px;left:50%;margin-left:-2px;}' +
                '.cke_imgresize_br {bottom:-3px;right:-3px;}' +

                '.cke_imgresize_controls {visibility:hidden;position:absolute;top:0;left:0;right:0;bottom:0px;}' +
                '.cke_imgresize_preview {visibility:visible;pointer-events:none;display:none;position:absolute;top:0;left:0;right:0;bottom:0px;background-size:100% 100%;opacity:.65;outline:1px dashed #000;}'
            );
        },

        init: function(editor) {
            if (!CKEDITOR.env.webkit) {
                return;
            }

            editor._imgresize = new Resizer(editor);
            editor._imgresizeWrapper = CKEDITOR.dom.element.createFromHtml(
                '<span tabindex="-1" class="cke_imgresize_wrapper" data-cke-imgresize-wrapper="1" data-cke-filter="off">' +
                    '<span class="cke_imgresize_controls">' +
                        '<span class="cke_imgresize_preview"></span>' +
                        '<i class="cke_imgresize_tl" data-cke-imgresize="tl"></i>' +
                        '<i class="cke_imgresize_tm" data-cke-imgresize="tm"></i>' +
                        '<i class="cke_imgresize_tr" data-cke-imgresize="tr"></i>' +
                        '<i class="cke_imgresize_lm" data-cke-imgresize="lm"></i>' +
                        '<i class="cke_imgresize_rm" data-cke-imgresize="rm"></i>' +
                        '<i class="cke_imgresize_bl" data-cke-imgresize="bl"></i>' +
                        '<i class="cke_imgresize_bm" data-cke-imgresize="bm"></i>' +
                        '<i class="cke_imgresize_br" data-cke-imgresize="br"></i>' +
                    '</span>' +
                '</span>'
            );

            editor.on('contentDom', this._updateEvents);
            editor.on('readOnly', this._updateEvents);
            editor.on('mode', this._updateEvents);
        },

        afterInit: function(editor) {
            if (!CKEDITOR.env.webkit) {
                return;
            }

            var rules = {
                'attributes': {
                    'class': function(value, element) {
                        if (value.indexOf('cke_imgresize') !== -1) {
                            element.replaceWithChildren();
                            return value.replace(REG_CLASS_REPLACE, ' ');
                        }
                    }
                }
            };

            editor.dataProcessor.htmlFilter.addRules(rules, { 'applyToAll': true, 'priority': 0 });
            editor.dataProcessor.dataFilter.addRules(rules, { 'applyToAll': true, 'priority': 0 });
        },

        _updateEvents: function() {
            var plugin = this.plugins.imgresize;

            this.document && this.document.removeListener('click', plugin._onClick);
            this.removeListener('loadSnapshot', plugin._onLoadSnapshot);

            if (!this.readOnly && this.mode === 'wysiwyg') {
                this.document && this.document.on('click', plugin._onClick, this);
                this.on('loadSnapshot', plugin._onLoadSnapshot, this, null, 5);
            }
        },

        _onLoadSnapshot: function(event) {
            if (!event.data || event.data.indexOf('cke_imgresize') === -1) {
                return;
            }

            var fragment = CKEDITOR.htmlParser.fragment.fromHtml(event.data);
            var writer = new CKEDITOR.htmlParser.basicWriter();
            fragment.filter(this.dataProcessor.htmlFilter);
            fragment.writeHtml(writer);

            event.data = writer.getHtml();
        },

        _onClick: function(event) {
            var nativeEvent = event.data.$;

            if (nativeEvent.button !== 0) {
                return;
            }

            if (nativeEvent.target.tagName !== 'IMG') {
                return;
            }

            this._imgresize.show(new CKEDITOR.dom.element(nativeEvent.target));
        }
    });





    function Resizer(editor) {
        this._editor = editor;
    }

    Resizer.prototype._editorHideEvents = {
        'beforeCommandExec': 1,
        'beforeSetMode': 1,
        'dragstart': 1,
        'paste': 1,
        'readOnly': 1
    };

    Resizer.prototype.show = function(element) {
        this._element = element;
        this._wrapper = this._getWrapper(this._element);

        if (!this._wrapper) {
            this._wrapper = this._editor._imgresizeWrapper.clone(true);
            this._wrapper.replace(this._element);
            this._element.appendTo(this._wrapper);
        }

        this._editor.getSelection().removeAllRanges();
        this._wrapper.focus();

        this._controls = this._wrapper.findOne('.cke_imgresize_controls');
        this._preview = this._wrapper.findOne('.cke_imgresize_preview');

        this._wrapper.on('drag:start', this._onDragStart, this);
        this._wrapper.on('drag:drag', this._onDragDrag, this);
        this._wrapper.on('drag:stop', this._onDragStop, this);
        this._wrapper.on('mousedown', this._initDrag, this, null, 0);
        this._wrapper.once('blur', this._hideWrapper, this, null, 0);

        for (var eventName in this._editorHideEvents) {
            this._editor.once(eventName, this._hideWrapper, this, null, 0);
        }

        this._resetBox();
        this._controls.setStyles({
            'top': '0px',
            'left': '0px',
            'width': this._box.width + 'px',
            'height': this._box.height + 'px'
        });
    };

    Resizer.prototype._hideWrapper = function() {
        if (!this._wrapper) {
            return;
        }

        for (var eventName in this._editorHideEvents) {
            this._editor.removeListener(eventName, this._hideWrapper);
        }

        this._wrapper.removeAllListeners();
        this._element.replace(this._wrapper);

        delete this._wrapper;
        delete this._element;
        delete this._controls;
        delete this._preview;
    };

    Resizer.prototype._getWrapper = function(element) {
        var wrapper = element.getParent();

        if (wrapper &&
            wrapper.type === CKEDITOR.NODE_ELEMENT &&
            wrapper.data('cke-imgresize-wrapper')) {

            return wrapper;
        }
    };

    Resizer.prototype._initDrag = function(event) {
        var nativeEvent = event.data.$;
        if (nativeEvent.button !== 0) {
            return;
        }

        if (nativeEvent.target.tagName !== 'I') {
            return;
        }

        nativeEvent.stopImmediatePropagation();
        nativeEvent.preventDefault();

        new DragEvent(this._editor, this._wrapper).start(event);
    };

    Resizer.prototype._onDragStart = function() {
        this._preview.setStyles({
            'display': 'block',
            'backgroundImage': 'url("' + this._element.getAttribute('src') + '")'
        });

        this._resetBox();
        this._editor.getSelection().lock();
    };

    Resizer.prototype._onDragDrag = function(event) {
        var box = this._calculateSize(event.data);

        this._controls.setStyles({
            'top': box.top + 'px',
            'left': box.left + 'px',
            'width': box.width + 'px',
            'height': box.height + 'px'
        });
    };

    Resizer.prototype._onDragStop = function(event) {
        var box = this._calculateSize(event.data);

        this._preview.setStyle('display', 'none');

        this._controls.setStyles({
            'top': '0px',
            'left': '0px',
            'width': box.width + 'px',
            'height': box.height + 'px'
        });

        this._element.setStyles({
            'width': box.width + 'px',
            'height': box.height + 'px'
        });

        this._editor.getSelection().unlock();
        this._editor.fire('saveSnapshot');
    };

    Resizer.prototype._calculateSize = function(data) {
        var box = {
            'top': 0,
            'left': 0,
            'width': this._box.width,
            'height': this._box.height
        };

        var isRight = (data.attr.indexOf('r') !== -1);
        var isLeft = (data.attr.indexOf('l') !== -1);
        var isTop = (data.attr.indexOf('t') !== -1);
        var isBottom = (data.attr.indexOf('b') !== -1);
        var isMiddle = (data.attr.indexOf('m') !== -1);

        if (isRight) {
            box.width = Math.max(32, this._box.width + data.delta.x);
        }

        if (isBottom) {
            box.height = Math.max(32, this._box.height + data.delta.y);
        }

        if (isLeft) {
            box.width = Math.max(32, this._box.width - data.delta.x);
        }

        if (isTop) {
            box.height = Math.max(32, this._box.height - data.delta.y);
        }

        if (!isMiddle && !data.keys.shift) {
            var ratio = this._box.width / this._box.height;

            if (box.width / box.height > ratio) {
                box.height = Math.round(box.width / ratio);

            } else {
                box.width = Math.round(box.height * ratio);
            }
        }

        if (isLeft) {
            box.left = this._box.width - box.width;
        }

        if (isTop) {
            box.top = this._box.height - box.height;
        }

        return box;
    };

    Resizer.prototype._resetBox = function() {
        this._box = {
            'top': 0,
            'left': 0,
            'width': this._element.$.clientWidth,
            'height': this._element.$.clientHeight
        };
    };


    function DragEvent(editor, wrapper) {
        this._editor = editor;
        this._wrapper = wrapper;
    }

    DragEvent.prototype.start = function(event) {
        var nativeEvent = event.data.$;

        this._attr = nativeEvent.target.getAttribute('data-cke-imgresize');
        this._startPos = {
            'x': nativeEvent.clientX,
            'y': nativeEvent.clientY
        };
        this._keys = {
            'shift': nativeEvent.shiftKey,
            'ctrl': nativeEvent.ctrlKey,
            'alt': nativeEvent.altKey
        };

        this._update(event);

        this._editor.document.on('mousemove', this._onMousemove, this, null, 0);
        this._editor.document.on('mouseup', this._onMouseup, this, null, 0);
        this._wrapper.fire('drag:start');
    };

    DragEvent.prototype._update = function(event) {
        var nativeEvent = event.data.$;

        this._delta = {
            'x': nativeEvent.clientX - this._startPos.x,
            'y': nativeEvent.clientY - this._startPos.y
        };
    };

    DragEvent.prototype._onMousemove = function(event) {
        this._update(event);
        this._wrapper.fire('drag:drag', {
            'attr': this._attr,
            'delta': this._delta,
            'keys': this._keys
        });

        if (event.data.$.which === 0) {
            this._onMouseup(event);
        }
    };

    DragEvent.prototype._onMouseup = function(event) {
        this._update(event);
        this._editor.document.removeListener('mousemove', this._onMousemove);
        this._editor.document.removeListener('mouseup', this._onMouseup);
        this._wrapper.fire('drag:stop', {
            'attr': this._attr,
            'delta': this._delta,
            'keys': this._keys
        });
    };

}());
