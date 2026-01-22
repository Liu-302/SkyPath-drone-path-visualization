import * as THREE from 'three'
import type { Object3D } from 'three'
import { BACKEND_CONFIG } from '../config/backend.config'

/**
 * 后端模型数据接口
 */
interface BackendModelData {
  vertices: Float32Array
  normals?: Float32Array
  uvs?: Float32Array
  indices?: Uint16Array | Uint32Array
  boundingBox: [number, number, number, number, number, number]
  vertexCount: number
  triangleCount: number
}

/**
 * 后端模型服务
 * 负责与后端API交互,上传OBJ文件并获取优化后的模型数据
 */

export class BackendModelService {
  private static get BASE_URL() {
    return BACKEND_CONFIG.API_BASE_URL
  }
  
  private static get DEFAULT_PROJECT_ID() {
    return BACKEND_CONFIG.DEFAULT_PROJECT_ID
  }
  
  /** 是否使用后端模式 */
  private static useBackend = BACKEND_CONFIG.ENABLED

  /**
   * 上传OBJ文件到后端
   */
  static async uploadOBJ(file: File, projectId: string = this.DEFAULT_PROJECT_ID): Promise<BackendModelData> {
    if (!this.useBackend) {
      throw new Error('后端服务未启用')
    }
    
    const formData = new FormData()
    formData.append('file', file)

    console.log(`[后端服务] 上传OBJ文件: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)

    let response: Response
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT)
      
      response = await fetch(`${this.BASE_URL}/${projectId}/model`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = `上传失败: ${response.status}`
        if (response.status === 413) {
          errorMessage = '文件太大，服务器无法处理。请尝试压缩文件或使用更小的模型。'
        } else if (response.status === 500) {
          errorMessage = '服务器处理文件时出错，可能是文件格式问题或内存不足。'
        } else {
          const errorText = await response.text().catch(() => response.statusText)
          if (errorText) {
            errorMessage += ` ${errorText}`
          }
        }
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查后端服务是否正常运行')
      }
      if (error.message?.includes('Failed to fetch')) {
        throw new Error('无法连接到后端服务，请确保后端服务正在运行')
      }
      throw error
    }

    const data = await response.json()

    console.log(`[后端服务] OBJ上传成功:`, {
      原始大小: `${(data.originalSize / 1024).toFixed(2)} KB`,
      优化后: `${(data.optimizedSize / 1024).toFixed(2)} KB`,
      压缩率: `${data.compressionRatio.toFixed(2)}%`,
      顶点数: data.vertexCount,
      三角形数: data.triangleCount,
      解析耗时: `${data.parseTime}ms`,
      优化耗时: `${data.optimizeTime}ms`,
    })

    return this.convertToThreeJS(data)
  }

  /**
   * 从后端加载模型数据
   */
  static async loadModelData(projectId: string = this.DEFAULT_PROJECT_ID): Promise<BackendModelData> {
    console.log(`[后端服务] 加载模型数据: 项目ID=${projectId}`)

    const response = await fetch(`${this.BASE_URL}/${projectId}/model`)
    if (!response.ok) {
      throw new Error(`加载失败: ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`[后端服务] 模型数据加载成功:`, {
      顶点数: data.vertexCount,
      三角形数: data.triangleCount,
    })

    return this.convertToThreeJS(data)
  }

  /**
   * 删除后端模型数据
   */
  static async deleteModelData(projectId: string = this.DEFAULT_PROJECT_ID): Promise<void> {
    console.log(`[后端服务] 删除模型数据: 项目ID=${projectId}`)

    const response = await fetch(`${this.BASE_URL}/${projectId}/model`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`删除失败: ${response.statusText}`)
    }

    console.log(`[后端服务] 模型数据已删除`)
  }

  /**
   * 将后端数据转换为Three.js可用的格式
   */
  private static convertToThreeJS(data: any): BackendModelData {
    // 确保数据存在
    if (!data || !data.vertices || !Array.isArray(data.vertices)) {
      throw new Error('无效的模型数据：缺少顶点数据')
    }

    // 转换顶点数据
    const vertices = new Float32Array(data.vertices)
    
    // 转换法线数据
    let normals: Float32Array | undefined = undefined
    if (data.normals && Array.isArray(data.normals) && data.normals.length > 0) {
      normals = new Float32Array(data.normals)
    }

    // 转换UV数据
    let uvs: Float32Array | undefined = undefined
    if (data.uvs && Array.isArray(data.uvs) && data.uvs.length > 0) {
      uvs = new Float32Array(data.uvs)
    }

    // 转换索引数据 - 确保是整数数组
    let indices: Uint16Array | Uint32Array | undefined = undefined
    if (data.indices && Array.isArray(data.indices) && data.indices.length > 0) {
      // 检查索引值范围，决定使用 Uint16 还是 Uint32
      const maxIndex = Math.max(...data.indices)
      if (maxIndex < 65535) {
        indices = new Uint16Array(data.indices)
      } else {
        indices = new Uint32Array(data.indices)
      }
    }

    console.log('[数据转换] 模型数据:', {
      顶点数: vertices.length / 3,
      法线数: normals ? normals.length / 3 : 0,
      UV数: uvs ? uvs.length / 2 : 0,
      索引数: indices ? indices.length : 0,
      三角形数: indices ? indices.length / 3 : 0,
    })

    return {
      vertices,
      normals,
      uvs,
      indices,
      boundingBox: data.boundingBox,
      vertexCount: data.vertexCount,
      triangleCount: data.triangleCount,
    }
  }

  /**
   * 从后端模型数据创建Three.js Mesh对象
   */
  static createMeshFromData(modelData: BackendModelData): THREE.Mesh {
    const geometry = new THREE.BufferGeometry()

    // 验证数据
    if (!modelData.vertices || modelData.vertices.length === 0) {
      throw new Error('模型数据无效：缺少顶点数据')
    }

    if (modelData.vertices.length % 3 !== 0) {
      throw new Error(`模型数据无效：顶点数量不是3的倍数 (${modelData.vertices.length})`)
    }

    const vertexCount = modelData.vertices.length / 3
    console.log('[Three.js] 创建Mesh:', {
      顶点数: vertexCount,
      索引数: modelData.indices ? modelData.indices.length : 0,
      三角形数: modelData.indices ? modelData.indices.length / 3 : 0,
    })

    // 设置顶点位置
    geometry.setAttribute('position', new THREE.BufferAttribute(modelData.vertices, 3))

    // 设置法线
    if (modelData.normals && modelData.normals.length > 0) {
      if (modelData.normals.length !== modelData.vertices.length) {
        console.warn('[Three.js] 法线数量与顶点数量不匹配，将自动计算法线')
        console.warn(`  顶点数: ${modelData.vertices.length}, 法线数: ${modelData.normals.length}`)
        geometry.computeVertexNormals()
      } else {
        geometry.setAttribute('normal', new THREE.BufferAttribute(modelData.normals, 3))
      }
    } else {
      // 如果没有法线,自动计算
      geometry.computeVertexNormals()
    }

    // 设置UV坐标
    if (modelData.uvs && modelData.uvs.length > 0) {
      // UV数量应该是顶点数量的2/3（每个顶点2个UV坐标）
      const expectedUVCount = vertexCount * 2
      if (modelData.uvs.length === expectedUVCount) {
        geometry.setAttribute('uv', new THREE.BufferAttribute(modelData.uvs, 2))
      } else {
        console.warn(`[Three.js] UV数量不匹配: 期望 ${expectedUVCount}, 实际 ${modelData.uvs.length}`)
      }
    }

    // 设置索引
    if (modelData.indices && modelData.indices.length > 0) {
      if (modelData.indices.length % 3 !== 0) {
        throw new Error(`模型数据无效：索引数量不是3的倍数 (${modelData.indices.length})`)
      }
      
      // 验证索引范围
      const maxIndex = Math.max(...Array.from(modelData.indices))
      if (maxIndex >= vertexCount) {
        console.error(`[Three.js] 索引超出范围: 最大索引 ${maxIndex}, 顶点数 ${vertexCount}`)
        throw new Error(`模型数据无效：索引超出范围 (最大索引: ${maxIndex}, 顶点数: ${vertexCount})`)
      }

      // setIndex 应该直接接受数组，不需要 BufferAttribute
      geometry.setIndex(modelData.indices)
    } else {
      // 如果没有索引，使用顺序索引（非索引几何体）
      console.warn('[Three.js] 没有索引数据，使用顺序索引')
    }

    // 创建材质
    const material = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      metalness: 0.1,
      roughness: 0.8,
      emissive: 0x111111,
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      wireframe: false,
    })

    // 创建Mesh
    const mesh = new THREE.Mesh(geometry, material)

    // 计算包围盒用于调试
    const box = new THREE.Box3().setFromObject(mesh)
    const size = box.getSize(new THREE.Vector3())
    console.log('[Three.js] 创建Mesh成功:', {
      尺寸: {
        x: size.x.toFixed(2),
        y: size.y.toFixed(2),
        z: size.z.toFixed(2),
      },
      顶点数: geometry.attributes.position.count,
      三角形数: geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3,
    })

    return mesh
  }

  /**
   * 从后端数据创建完整的3D对象(可能包含多个Mesh)
   */
  static createObjectFromData(modelData: BackendModelData): Object3D {
    const mesh = this.createMeshFromData(modelData)

    // 如果有多个网格组,可以在这里创建Group
    // 目前简化为单个Mesh
    const group = new THREE.Group()
    group.add(mesh)

    return group
  }
}

export default BackendModelService
