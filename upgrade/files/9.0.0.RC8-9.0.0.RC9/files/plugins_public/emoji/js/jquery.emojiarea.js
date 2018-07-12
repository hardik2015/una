/**
 * emojiarea - A rich textarea control that supports emojis, WYSIWYG-style.
 * Copyright (c) 2012 DIY Co
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 * file except in compliance with the License. You may obtain a copy of the License at:
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 * @author Brian Reavis <brian@diy.org>
 */

/**
 * This file also contains some modifications by Igor Zhukov in order to add
 * custom scrollbars to EmojiMenu See keyword `MODIFICATION` in source code.
 */
(function($, window, document) {

  var ELEMENT_NODE = 1;
  var TEXT_NODE = 3;
  var TAGS_BLOCK = [ 'p', 'div', 'pre', 'form' ];
  var KEY_ESC = 27;
  var KEY_TAB = 9;
  /* Keys that are not intercepted and canceled when the textbox has reached its max length:
        Backspace, Tab, Ctrl, Alt, Left Arrow, Up Arrow, Right Arrow, Down Arrow, Cmd Key, Delete
  */
  var MAX_LENGTH_ALLOWED_KEYS = [8, 9, 17, 18, 37, 38, 39, 40, 91, 46];

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  /*
   * ! MODIFICATION START Options 'spritesheetPath', 'spritesheetDimens',
   * 'iconSize' added by Andre Staltz.
   */
  $.emojiarea = {    
    iconSize : 25,
    icons : {},
  };
  
  
  var defaultRecentEmojis = ':joy:,:kissing_heart:,:heart:,:heart_eyes:,:blush:,:grin:,:+1:,:relaxed:,:pensive:,:smile:,:sob:,:kiss:,:unamused:,:flushed:,:stuck_out_tongue_winking_eye:,:see_no_evil:,:wink:,:smiley:,:cry:,:stuck_out_tongue_closed_eyes:,:scream:,:rage:,:smirk:,:disappointed:,:sweat_smile:,:kissing_closed_eyes:,:speak_no_evil:,:relieved:,:grinning:,:yum:,:laughing:,:ok_hand:,:neutral_face:,:confused:'
      .split(',');
  /* ! MODIFICATION END */

  $.fn.emojiarea = function(options) {
    options = $.extend({}, options);
    return this
      .each(function () {
        var originalInput = $(this);
        if ('contentEditable' in document.body && options.wysiwyg !== false)
		{
          var id = getGuid();
          new EmojiArea_WYSIWYG(originalInput, id, $.extend({}, options));
        } else {
          var id = getGuid();
          new EmojiArea_Plain(originalInput, id, options);
        }
	
        originalInput.attr(
          {
            'data-emojiable': 'converted',
            'data-id': id,
            'data-type': 'original-input'
          });
      });
  };

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  var util = {};

  util.restoreSelection = (function() {
    if (window.getSelection) {
      return function(savedSelection) {
        var sel = window.getSelection();
        sel.removeAllRanges();
        for (var i = 0, len = savedSelection.length; i < len; ++i) {
          sel.addRange(savedSelection[i]);
        }
      };
    } else if (document.selection && document.selection.createRange) {
      return function(savedSelection) {
        if (savedSelection) {
          savedSelection.select();
        }
      };
    }
  })();

  util.saveSelection = (function() {
    if (window.getSelection) {
      return function() {
        var sel = window.getSelection(), ranges = [];
        if (sel.rangeCount) {
          for (var i = 0, len = sel.rangeCount; i < len; ++i) {
            ranges.push(sel.getRangeAt(i));
          }
        }
        return ranges;
      };
    } else if (document.selection && document.selection.createRange) {
      return function() {
        var sel = document.selection;
        return (sel.type.toLowerCase() !== 'none') ? sel.createRange()
            : null;
      };
    }
  })();

  util.replaceSelection = (function() {
	if (window.getSelection)
	{
	   return function(content)
	   {
			var range, sel = window.getSelection();
			var node = typeof content === 'string' ? document.createTextNode(content) : content;
			if (sel.getRangeAt && sel.rangeCount) {
			  range = sel.getRangeAt(0);
			  range.deleteContents();			  
			  range.insertNode(node);
			  range.setStart(node, 0);

			  window.setTimeout(function()
			  {
				range = document.createRange();
				range.setStartAfter(node);
				range.collapse(true);
				sel.removeAllRanges();
				sel.addRange(range);				
			  }, 0);
			}
			
      }
    }
	else if (document.selection && document.selection.createRange)
	{
      return function(content)
	  {
        var range = document.selection.createRange();
        if (typeof content === 'string') {
          range.text = content;
        } else {
          range.pasteHTML(content.outerHTML);
        }
      }
    }
  })();

  util.insertAtCursor = function(text, el)
{
    text = ' ' + text;
	var val = el.value, endIndex, startIndex, range;
    if (typeof el.selectionStart != 'undefined'
        && typeof el.selectionEnd != 'undefined') {
      startIndex = el.selectionStart;
      endIndex = el.selectionEnd;
      el.value = val.substring(0, startIndex) + text
          + val.substring(el.selectionEnd);
      el.selectionStart = el.selectionEnd = startIndex + text.length;
    } else if (typeof document.selection != 'undefined'
        && typeof document.selection.createRange != 'undefined') {
      el.focus();
      range = document.selection.createRange();
      range.text = text;
      range.select();
    }
  };

  util.extend = function(a, b) {
    if (typeof a === 'undefined' || !a) {
      a = {};
    }
    if (typeof b === 'object') {
      for ( var key in b) {
        if (b.hasOwnProperty(key)) {
          a[key] = b[key];
        }
      }
    }
    return a;
  };

  util.escapeRegex = function(str) {
    return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
  };

  util.htmlEntities = function(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /*
   * ! MODIFICATION START This function was added by Igor Zhukov to save
   * recent used emojis.
   */
  util.emojiInserted = function(emojiKey, menu) {
    ConfigStorage.get('emojis_recent', function(curEmojis) {
      curEmojis = curEmojis || defaultRecentEmojis || [];

      var pos = curEmojis.indexOf(emojiKey);
      if (!pos) {
        return false;
      }
      if (pos != -1) {
        curEmojis.splice(pos, 1);
      }
      curEmojis.unshift(emojiKey);
      if (curEmojis.length > 42) {
        curEmojis = curEmojis.slice(42);
      }

      ConfigStorage.set({
        emojis_recent : curEmojis
      });
    })
  };
  /* ! MODIFICATION END */

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var EmojiArea = function() {
  };

  EmojiArea.prototype.setup = function() {
    var self = this;

    this.$editor.on('focus', function() {
      self.hasFocus = true;
    });
    this.$editor.on('blur', function() {
      self.hasFocus = false;
    });

    // Assign a unique instance of an emojiMenu to
    self.emojiMenu = new EmojiMenu(self);

    this.setupButton();
  };

  EmojiArea.prototype.setupButton = function() {
    var self = this;
    var $button = $('[data-id=' + this.id + '][data-type=picker]');

    $button.on('click', function(e) {
      self.emojiMenu.show(self);
    });

    this.$button = $button;
    this.$dontHideOnClick = 'emoji-picker';
  };

  /*
   * ! MODIFICATION START This function was modified by Andre Staltz so that
   * the icon is created from a spritesheet.
   */
  EmojiArea.createIcon = function(emoji, menu)
  {
	var name = emoji[3];
	return '<div>' + $.emojiarea.reverseIcons[name.substr(1, name.length-2)] + '</div>';
  };

  $.emojiarea.createIcon = EmojiArea.createIcon;
  /* ! MODIFICATION END */

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  /**
   * Editor (plain-text)
   *
   * @constructor
   * @param {object}
   *            $textarea
   * @param {object}
   *            options
   */

  var EmojiArea_Plain = function($textarea, id, options) {
    this.options = options;
    this.$textarea = $textarea;
    this.$editor = $textarea;
    this.id = id;
    this.setup();
  };

  EmojiArea_Plain.prototype.insert = function(emoji) {
    if (!$.emojiarea.icons.hasOwnProperty(emoji))
      return;
    util.insertAtCursor(emoji, this.$textarea[0]);
    /*
     * MODIFICATION: Following line was added by Igor Zhukov, in order to
     * save recent emojis
     */
    util.emojiInserted(emoji, this.menu);
    this.$textarea.trigger('change');
  };

  EmojiArea_Plain.prototype.val = function() {
    if (this.$textarea == '\n')
      return '';
    return this.$textarea.val();
  };

  util.extend(EmojiArea_Plain.prototype, EmojiArea.prototype);

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  /**
   * Editor (rich)
   *
   * @constructor
   * @param {object}
   *            $textarea
   * @param {object}
   *            options
   */

  var EmojiArea_WYSIWYG = function($textarea, id, options) {
    var self = this;
    this.options = options || {};
    this.id = id;
    this.$textarea = $textarea;
    this.emojiPopup = options.emojiPopup;
    
	this.$editor = $(this.$textarea).addClass('emoji-wysiwyg-editor');
	this.$editor.data('self', this);
	
    if ($textarea.attr('maxlength'))
      this.$editor.attr('maxlength', $textarea.attr('maxlength'));

    var changeEvents = 'blur change';
    if (!this.options.norealTime) {
      changeEvents += ' keyup';
    }
    this.$editor.on(changeEvents, function(e) {
      return self.onChange.apply(self, [ e ]);
    });


    this.$editor.on('mousedown focus', function() {
      document.execCommand('enableObjectResizing', false, false);
    });
    this.$editor.on('blur', function() {
      document.execCommand('enableObjectResizing', true, true);
    });
	
	this.$editor.on('focus', function() {
		var $this = $(this);
		$this.data('before', $this.text());
		return $this;
	}).on('blur keyup paste input', function() {
		var $this = $(this);
		if ($this.data('before') !== $this.text()) {
			$this.data('before', $this.text());
			$this.trigger('change');
		}
		return $this;
	});

    var editorDiv = this.$editor;
    this.$editor.on("change keydown keyup resize scroll", function(e) {
      if(MAX_LENGTH_ALLOWED_KEYS.indexOf(e.which) == -1 &&
        !((e.ctrlKey || e.metaKey) && e.which == 65) && // Ctrl + A
        !((e.ctrlKey || e.metaKey) && e.which == 67) && // Ctrl + C
        editorDiv.text().length + editorDiv.find('img').length >= editorDiv.attr('maxlength'))
      {
        e.preventDefault();
      }
      
	  self.updateBodyPadding(editorDiv);
	  
	  if(e.which == 8 || e.which == 46)
		  $(this).trigger('change');
    });

    if (this.options.onPaste)
	{
      var self = this;
      this.$editor.on("paste", function (e) {
        e.preventDefault();

        if ((e.originalEvent || e).clipboardData) {
          var content = (e.originalEvent || e).clipboardData.getData('text/plain');
          var finalText = self.options.onPaste(content);
          document.execCommand('insertText', false, finalText);
        }
        else if (window.clipboardData) {
          var content = window.clipboardData.getData('Text');
          var finalText = self.options.onPaste(content);
          document.selection.createRange().pasteHTML(finalText);
        }
        editorDiv.scrollTop(editorDiv[0].scrollHeight);
      });
    }
  	
	if (typeof options.custom_events !== 'undefined')
	{
		for(evt in options.custom_events)			
			this.$editor.on(evt, options.custom_events[evt]);
	}

	var 
		oMenuWrapper = typeof this.options.menu_wrapper !== 'undefined' ? $(this.options.menu_wrapper) : $('<a class="smiles"></a>'),		
		oMenuIcon = typeof this.options.menu_icon !== 'undefined' ? $(this.options.menu_icon) : $('<i class="sys-icon far smile"></i>');
	
	oMenuIcon
		.attr('data-id', id)
		.attr('data-type', 'picker')
		.addClass('emoji-picker-icon emoji-picker');
		
	if (!$(document).find(oMenuIcon).length)
		oMenuWrapper.wrapInner(oMenuIcon);
		
	if (!$(document).find(oMenuWrapper).length)
		$(this.$editor).after(oMenuWrapper);
		
	this.setup();
	
	if (typeof options.set_focus !== 'undefined' && options.set_focus === true)
		this.$editor.trigger('focus');

    /*
     * MODIFICATION: Following line was modified by Igor Zhukov, in order to
     * improve emoji insert behaviour
     */
	$(document.body).on('mousedown', function() {
	  if (self.hasFocus) {
		self.selection = util.saveSelection();
	  }
	});
  };

  EmojiArea_WYSIWYG.prototype.updateBodyPadding = function(target) {
    var emojiPicker = $('[data-id=' + this.id + '][data-type=picker]');
    if ($(target).hasScrollbar()) {
      if (!(emojiPicker.hasClass('parent-has-scroll')))
        emojiPicker.addClass('parent-has-scroll');
      if (!($(target).hasClass('parent-has-scroll')))
        $(target).addClass('parent-has-scroll');
    } else {
      if ((emojiPicker.hasClass('parent-has-scroll')))
        emojiPicker.removeClass('parent-has-scroll');
      if (($(target).hasClass('parent-has-scroll')))
        $(target).removeClass('parent-has-scroll');
    }
  };

  EmojiArea_WYSIWYG.prototype.onChange = function(e)
  {	
		this.$textarea.val(this.val());
  };

  EmojiArea_WYSIWYG.prototype.insert = function(emoji) {
    var insertionContent = this.emojiPopup.colonToUnicode(emoji);

	if (!this.$editor.filter("[id='tinymce']").length)
	{
		this.$editor
			.trigger('focus')
			.trigger('keydown');
			
		if (this.selection)
			util.restoreSelection(this.selection);
		try
		{
			util.replaceSelection(insertionContent);			
		}
		catch (e)
		{
		}
	}
	else 
		tinymce.execCommand('mceInsertContent', false, insertionContent); 
		
   
	util.emojiInserted(emoji, this.menu);
    this.onChange();
  };
  
  EmojiArea_WYSIWYG.prototype.val = function() {
    var lines = [],
		line = [],
		emojiPopup = this.emojiPopup,
		_this = this;
	
	var flush = function() {
      lines.push(line.join(''));
      line = [];
    };

    var sanitizeNode = function(node) {		
	if (node.nodeType === TEXT_NODE) {
			function escapeRegex(text) {
				return text.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
			}
						
			function replaceAll(str, map) {
					var re = new RegExp('(^|[,.\\s])(' + Object.keys(map).map(escapeRegex).join('|') + ')([,.\\s]|$)', "g");
					return str.replace(re, function(m, p1, p2, p3) {
						return p1 + ':' + map[p2] + ':' + p3;
				}).replace(re, function(m, p1, p2, p3) {
					return p1 + ':' + map[p2] + ':' + p3;
				});
			}
	
			if (typeof _this.options.convert_to_emoji !== 'undefined')
				line.push(replaceAll(node.nodeValue, Config.smileys));
			else 
				line.push(node.nodeValue);
			
      } else if (node.nodeType === ELEMENT_NODE) {
        var tagName = node.tagName.toLowerCase();
        var isBlock = TAGS_BLOCK.indexOf(tagName) !== -1;

        if (isBlock && line.length)
          flush();

        if (tagName === 'img') {
          var alt = node.getAttribute('alt') || '';
          if (alt) {
              line.push(alt);
          }
          return;
        } else if (tagName === 'br') {
          flush();
        }

        var children = node.childNodes;
        for (var i = 0; i < children.length; i++) {
           sanitizeNode(children[i]);
        }

        if (isBlock && line.length)
          flush();
      }
    };

    var children = this.$editor[0].childNodes;
    for (var i = 0; i < children.length; i++) {
      sanitizeNode(children[i]);
    }

    if (line.length)
      flush();

    var returnValue = lines.join('\n');

    return emojiPopup.colonToUnicode(returnValue);
  };

  util.extend(EmojiArea_WYSIWYG.prototype, EmojiArea.prototype);

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  jQuery.fn.hasScrollbar = function() {
    var scrollHeight = this.get(0).scrollHeight;

    //safari's scrollHeight includes padding
    //if ($.browser.safari)
//      scrollHeight -= parseInt(this.css('padding-top')) + parseInt(this.css('padding-bottom'));
    if (this.outerHeight() < scrollHeight)
      return true;
    else
      return false;
  }

  /**
   * Emoji Dropdown Menu
   *
   * @constructor
   * @param {object}
   *            emojiarea
   */
  var EmojiMenu = function(emojiarea) {
    var self = this;
    self.id = emojiarea.id;
    var $body = $(document.body);
    var $window = $(window);

    this.visible = false;
    this.emojiarea = emojiarea;
    EmojiMenu.menuZIndex = 5000;
    this.$menu = $('<div>');
    this.$menu.addClass('emoji-menu');
    this.$menu.attr('data-id', self.id);
    this.$menu.attr('data-type', 'menu');
    this.$menu.hide();

    this.$itemsTailWrap = $('<div class="emoji-items-wrap1"></div>')
        .appendTo(this.$menu);
    this.$categoryTabs = $(
        '<table class="emoji-menu-tabs"><tr>'
            + '<td><a class="emoji-menu-tab"><i class="sys-icon far clock"></i></a></td>'
            + '<td><a class="emoji-menu-tab"><i class="sys-icon far smile"></i></a></td>'
            + '<td><a class="emoji-menu-tab"><i class="sys-icon dove"></i></a></td>'
            + '<td><a class="emoji-menu-tab"><i class="sys-icon bell"></i></a></td>'
            + '<td><a class="emoji-menu-tab"><i class="sys-icon car"></i></a></td>'
            + '<td><a class="emoji-menu-tab"><i class="sys-icon hashtag"></i></a></td>'
            + '</tr></table>').appendTo(this.$itemsTailWrap);
    this.$itemsWrap = $('<div class="emoji-items-wrap mobile_scrollable_wrap"></div>')
							.appendTo(this.$itemsTailWrap);
    
	this.$items = $('<div class="emoji-items">').appendTo(this.$itemsWrap);

	$('[data-id=' + self.id + '][data-type=picker]').parent().after(this.$menu);
	
    $body.on('keydown', function(e) {
      if (e.keyCode === KEY_ESC || e.keyCode === KEY_TAB) {
        self.hide();
      }
    });

    /*
     * ! MODIFICATION: Following 3 lines were added by Igor Zhukov, in order
     * to hide menu on message submit with keyboard
     */
    $body.on('message_send', function(e) {
      self.hide();
    });

    $body.on('mouseup', function(e) {
      /*
       * ! MODIFICATION START Following code was added by Igor Zhukov, in
       * order to prevent close on click on EmojiMenu scrollbar
       */
      e = e.originalEvent || e;
      var target = e.originalTarget || e.target || window;

      if ($(target).hasClass(self.emojiarea.$dontHideOnClick)) {
        return;
      }

      while (target && target != window) {
        target = target.parentNode;
        if (target == self.$menu[0] || self.emojiarea
            && target == self.emojiarea.$button[0]) {
          return;
        }
      }
      /* ! MODIFICATION END */
      self.hide();
    });

    this.$menu.on('mouseup', 'a', function(e) {
      e.stopPropagation();
      return false;
    });

    this.$menu.on('click', 'a', function(e) {

      self.emojiarea.updateBodyPadding(self.emojiarea.$editor);
	  
      if ($(this).hasClass('emoji-menu-tab'))
	  {
        if (self.getTabIndex(this) !== self.currentCategory) {
          self.selectCategory(self.getTabIndex(this));
        }
        return false;
      }

      var emoji = $('.label', $(this)).text();
      window.setTimeout(function() {
        self.onItemSelected(emoji);
        if (e.ctrlKey || e.metaKey) {
          self.hide();
        }
      }, 0);
      e.stopPropagation();
      return false;
    });

    this.selectCategory(0);
  };

  /*
   * ! MODIFICATION START Following code was added by Andre Staltz, to
   * implement category selection.
   */
  EmojiMenu.prototype.getTabIndex = function(tab) {
    return this.$categoryTabs.find('.emoji-menu-tab').index(tab);
  };

  EmojiMenu.prototype.selectCategory = function(category) {
    var self = this;
    this.$categoryTabs.find('.emoji-menu-tab').each(function(index) {
      if (index === category) {
        this.className += ' selected';
      } else {
        this.className = this.className.replace(' selected', '');
      }
    });
    this.currentCategory = category;
    this.load(category);
  };
  /* ! MODIFICATION END */

  EmojiMenu.prototype.onItemSelected = function(emoji) {
    if(this.emojiarea.$editor.text().length + this.emojiarea.$editor.find('img').length >= this.emojiarea.$editor.attr('maxlength'))
      return;
   
    this.emojiarea.insert(emoji);
  };

  /*
   * MODIFICATION: The following function argument was modified by Andre
   * Staltz, in order to load only icons from a category. Also function was
   * modified by Igor Zhukov in order to display recent emojis from
   * localStorage
   */
  EmojiMenu.prototype.load = function(category) {
    var html = [],
		options = $.emojiarea.icons,
		self = this;
    
    /*
     * ! MODIFICATION: Following function was added by Igor Zhukov, in order
     * to add scrollbars to EmojiMenu
     */
    var updateItems = function() {
      self.$items.html(html.join(''));
    }

    if (category > 0) {
      for ( var key in options) {
        /*
         * MODIFICATION: The following 2 lines were modified by Andre
         * Staltz, in order to load only icons from the specified
         * category.
         */
        if (options.hasOwnProperty(key)
            && options[key][0] === (category - 1)) {
          html.push('<a href="javascript:void(0)" title="'
              + util.htmlEntities(key) + '">'
              + EmojiArea.createIcon(options[key], true)
              + '<span class="label">' + util.htmlEntities(key)
              + '</span></a>');
        }
      }
      updateItems();
    } else {
      ConfigStorage.get('emojis_recent', function(curEmojis)
	  {
        curEmojis = curEmojis || defaultRecentEmojis || [];
        var key, i;
        for (i = 0; i < curEmojis.length; i++) {
          key = curEmojis[i]
          if (options[key])
		  {
            html.push('<a href="javascript:void(0)" title="'
                + util.htmlEntities(key) + '">'
                + EmojiArea.createIcon(options[key], true)
                + '<span class="label">'
                + util.htmlEntities(key) + '</span></a>');
          }
        }
        updateItems();
      });
    }
  };

  EmojiMenu.prototype.hide = function(callback) {
    this.visible = false;
    this.$menu.fadeOut();
  };

  EmojiMenu.prototype.show = function(emojiarea) {
	var position = typeof emojiarea.options.popup_position == 'function' ? emojiarea.options.popup_position() : emojiarea.options.popup_position || {right:'0'};	
	if (this.visible)
      return this.hide();
    
	$(this.$menu).css('z-index', ++EmojiMenu.menuZIndexcss);	
	
	this.$menu
		.css(position)
		.css({top:-this.$menu.height() - 10})
		.fadeIn();

    if (!this.currentCategory) {
      this.load(0);
    }
    this.visible = true;
  };

})(jQuery, window, document);

/** @} */
