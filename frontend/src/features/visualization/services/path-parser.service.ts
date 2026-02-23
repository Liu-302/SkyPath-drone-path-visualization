import { useDatasetStore } from '@/stores/dataset'

/**
 * 路径解析 Composable
 * 负责解析路径 JSON 文件
 */
export function usePathParser() {
  const store = useDatasetStore()

  /**
   * 解析路径文件
   */
  const parsePathFile = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      let points: any[] = []

      // 尝试多种数据格式
      if (Array.isArray(data)) {
        points = data
      } else if (data.points && Array.isArray(data.points)) {
        points = data.points
      } else if (data.path && Array.isArray(data.path)) {
        points = data.path
      } else if (data.coordinates && Array.isArray(data.coordinates)) {
        points = data.coordinates
      } else {
        // 尝试查找包含坐标数据的数组
        for (const key in data) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            const firstItem = data[key][0]
            const hasCoords =
              firstItem &&
              typeof firstItem === 'object' &&
              Object.keys(firstItem).some(k =>
                ['x', 'y', 'z', 'latitude', 'longitude', 'altitude', 'lat', 'lon', 'alt'].includes(k.toLowerCase())
              )
            if (hasCoords) {
              points = data[key]
              break
            }
          }
        }
      }

      if (points.length === 0) {
        throw new Error('Unable to parse path data: file format not supported. Expected an array of points with x, y, z coordinates.')
      }

      // 标准化路径点数据
      const standardizedPoints = points.map((p: any, index: number) => {
        const pos = p.position && typeof p.position === 'object' ? p.position : p
        const x = pos.x ?? pos.X ?? pos.lon ?? pos.lng ?? pos.longitude ?? pos.lat ?? pos.latitude ?? 0
        const y = pos.y ?? pos.Y ?? pos.alt ?? pos.altitude ?? pos.height ?? pos.elevation ?? 0
        const z = pos.z ?? pos.Z ?? pos.latitude ?? pos.lat ?? pos.longitude ?? pos.lon ?? 0

        // 提取 id（如果存在，否则使用索引）
        const id = p.id ?? index

        // 提取 normal（相机朝向向量）
        let normal = { x: 0, y: -1, z: 0 } // 默认向下
        if (p.normal && typeof p.normal === 'object') {
          // 如果 normal 在顶层
          normal = {
            x: p.normal.x ?? 0,
            y: p.normal.y ?? 0,
            z: p.normal.z ?? 0
          }
        } else if (pos.normal && typeof pos.normal === 'object') {
          // 如果 normal 在 position 对象内
          normal = {
            x: pos.normal.x ?? 0,
            y: pos.normal.y ?? 0,
            z: pos.normal.z ?? 0
          }
        }

        return { id, x, y, z, normal }
      })

      store.setParsedPoints(standardizedPoints)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.startsWith('Unable to parse') || msg.startsWith('Invalid JSON')) {
        throw error
      }
      if (msg.includes('JSON') || msg.includes('parse') || msg.includes('Unexpected')) {
        throw new Error('Invalid JSON format. Please check the path file.')
      }
      throw new Error(`Failed to parse path file: ${msg}`)
    }
  }

  return {
    parsePathFile
  }
}

