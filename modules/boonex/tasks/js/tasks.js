﻿/**
 * Copyright (c) UNA, Inc - https://una.io
 * MIT License - https://opensource.org/licenses/MIT 
 * @defgroup    Tasks Tasks
 * @ingroup     UnaModules
 *
 * @{
 */

function BxTasksView(oOptions) {
    this._sActionsUri = oOptions.sActionUri;
	
    var $this = this;
    $(document).ready(function () {
        $this.init();
    });
}

BxTasksView.prototype.init = function () {
    var $this = this;
}

BxTasksView.prototype.setCompleted = function (iId, oObj) {
    var $this = this;
	var iVal = ($(oObj).attr('checked') != 'checked' ? 0 : 1);
	$this._setCompleted(iId, iVal);
}

BxTasksView.prototype.setCompletedByMenu = function (iId, iValue, oObj) {
    var $this = this;
	$(oObj).addClass('bx-btn-disabled');
	$this._setCompleted(iId, iValue);
	document.location.reload(true);
}

BxTasksView.prototype._setCompleted = function (iId, iValue) {
	var $this = this;
	$.getJSON($this._sActionsUri + 'set_completed/' + iId + '/' + iValue + '/', {}, function () {});
}
	
BxTasksView.prototype.processTaskList = function (iContextId, iId, obj) {
    var $this = this;
	$(window).dolPopupAjax({
        url: $this._sActionsUri + 'process_task_list_form/' + iContextId + '/' + iId + '/' ,
        closeOnOuterClick: false,
		removeOnClose: true
    });   
}
	
BxTasksView.prototype.processTask = function (iContextId, iListId, obj) {
    var $this = this;
	$(window).dolPopupAjax({
        url: $this._sActionsUri + 'process_task_form/' + iContextId + '/' + iListId + '/' ,
        closeOnOuterClick: false,
        removeOnClose: true
    });   
}

BxTasksView.prototype.reloadData = function (oData, iContextId) {
	$(".bx-popup-applied:visible").dolPopupHide();
	var $this = this;
	loadDynamicBlockAuto($('.bx-tasks-tasklist-add'), window.location.href )
}

BxTasksView.prototype.setFilter = function (iListId, object) {
	var $this = this;
	var val = $(object).val();
	
	$('#bx-tasks-tasklist-' + iListId).removeClass (function (index, className) {
    	return (className.match (/(^|\s)bx-tasks-tasklist-filter-\S+/g) || []).join(' ');
	})
	if (val)
		$('#bx-tasks-tasklist-' + iListId).addClass('bx-tasks-tasklist-filter-' + val);
  	
	$.getJSON(this._sActionsUri + 'setFilterValue/' + iListId + '/' + val + '/' , function (oData) {
	});
}

