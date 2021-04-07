(function(window)
{
  let __package = "logi";
  let __name = "Application";

  class Application
  {
    static addDirectives()
    {
      zn.ng.directives[zn.ui.components.ng.textfield.tag]=zn.ui.components.ng.textfield.factory;
      zn.ng.directives[zn.ui.components.ng.textarea.tag]=zn.ui.components.ng.textarea.factory;
      zn.ng.directives[zn.ui.components.ng.button.tag]=zn.ui.components.ng.button.factory;
      zn.ng.directives[zn.ui.components.ng.calendar.tag]=zn.ui.components.ng.calendar.factory;
      zn.ng.directives[zn.ui.components.ng.checkboxfield.tag]=zn.ui.components.ng.checkboxfield.factory;
      zn.ng.directives[zn.ui.components.ng.datefield.tag]=zn.ui.components.ng.datefield.factory;
      zn.ng.directives[zn.ui.components.ng.dropdownfield.tag]=zn.ui.components.ng.dropdownfield.factory;
      zn.ng.directives[zn.ui.components.ng.radiogroup.tag]=zn.ui.components.ng.radiogroup.factory;
      zn.ng.directives[zn.ui.components.ng.popup.tag]=zn.ui.components.ng.popup.factory;
      zn.ng.directives[zn.ui.components.ng.dialog.tag]=zn.ui.components.ng.dialog.factory;
      zn.ng.directives[zn.ui.components.ng.list.tag]=zn.ui.components.ng.list.factory;
      zn.ng.directives[zn.ui.components.ng.table.tag]=zn.ui.components.ng.table.factory;
      zn.ng.directives[zn.ui.components.ng.draggable.tag]=zn.ui.components.ng.draggable.factory;
      zn.ng.directives[zn.ui.components.ng.editable.tag]=zn.ui.components.ng.editable.factory;
    }
  }

  Application.addDirectives();

  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = Application;

})(window);

