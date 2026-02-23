

import upload from 'C:/Users/34175/grp-skypath/src/pages/Upload.vue'
import visualize from 'C:/Users/34175/grp-skypath/src/pages/Visualize.vue'
import index from 'C:/Users/34175/grp-skypath/src/pages/index.vue'

export function getRoutes() {
  const routes = [
  {
    "path": "/Upload",
    "component": upload,
    "name": "Upload",
    "meta": {},
    "count": 7
  },
  {
    "path": "/Visualize",
    "component": visualize,
    "name": "Visualize",
    "meta": {},
    "count": 7
  },
  {
    "path": "/",
    "component": index,
    "name": "index",
    "meta": {},
    "count": 5
  }
];
  return routes;
}

