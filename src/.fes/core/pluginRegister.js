import { plugin } from './plugin';
import * as Plugin_0 from 'C:/Users/34175/grp-skypath/src/app.jsx';
import * as Plugin_1 from '@@/core/routes/runtime.js';

function handleDefaultExport(pluginExports) {
  // 避免编译警告
  const defaultKey = 'default';
  if (pluginExports[defaultKey]) {
    const {default: defaultExport, ...otherExports} = pluginExports;
    return {
      ...defaultExport,
      ...otherExports
    }
  }
  return pluginExports;
}

  plugin.register({
    apply: handleDefaultExport(Plugin_0),
    path: 'C:/Users/34175/grp-skypath/src/app.jsx',
  });
  plugin.register({
    apply: handleDefaultExport(Plugin_1),
    path: '@@/core/routes/runtime.js',
  });
