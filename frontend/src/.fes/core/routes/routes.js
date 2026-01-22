

import upload from 'D:/GRP_program/grp-skypath/frontend/src/pages/Upload.vue'
import visualize from 'D:/GRP_program/grp-skypath/frontend/src/pages/Visualize.vue'
import index from 'D:/GRP_program/grp-skypath/frontend/src/pages/index.vue'

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

