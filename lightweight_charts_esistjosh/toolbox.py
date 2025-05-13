import json
from .util import jbool 
from typing import Optional
from .util import TOOLBOX_MODE


 
class ToolBox:
    def __init__(self, chart, series_name = None, mode: Optional[TOOLBOX_MODE]= "legacy"):
        self.run_script = chart.run_script
        self.id = chart.id
        self._save_under = None
        self.drawings = {}
        toggle = mode != "legacy"
        chart.win.handlers[f'save_drawings{self.id}'] = self._save_drawings
        # quote the key so JS sees a string literal, or `null` if none
        # Emit a JS string literal for the key, or null if none.
        js_series_arg = f'"{series_name}"' if series_name else "null"
        # Call createToolBox(seriesKey, toggle)
        self.run_script(
            f"{self.id}.createToolBox({js_series_arg}, {jbool(toggle)})"
        )
    def save_drawings_under(self, widget: 'Widget'):
        """
        Drawings made on charts will be saved under the widget given. eg `chart.toolbox.save_drawings_under(chart.topbar['symbol'])`.
        """
        self._save_under = widget

    def load_drawings(self, tag: str):
        """
        Loads and displays the drawings on the chart stored under the tag given.
        """
        if not self.drawings.get(tag):
            return
        self.run_script(f'if ({self.id}.toolBox) {self.id}.toolBox.loadDrawings({json.dumps(self.drawings[tag])})')

    def import_drawings(self, file_path):
        """
        Imports a list of drawings stored at the given file path.
        """
        with open(file_path, 'r') as f:
            json_data = json.load(f)
            self.drawings = json_data

    def export_drawings(self, file_path):
        """
        Exports the current list of drawings to the given file path.
        """
        with open(file_path, 'w+') as f:
            json.dump(self.drawings, f, indent=4)

    def _save_drawings(self, drawings):
        if not self._save_under:
            return
        self.drawings[self._save_under.value] = json.loads(drawings)
    