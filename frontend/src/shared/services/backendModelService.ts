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
      throw new Error('Backend service is not enabled')
    }
    
    const formData = new FormData()
    formData.append('file', file)

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
        let errorMessage = `Upload failed: ${response.status}`
        if (response.status === 413) {
          errorMessage = 'File too large. Try compressing the file or using a smaller model.'
        } else if (response.status === 500) {
          errorMessage = 'Server error processing file. Check file format or try a smaller model.'
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
        throw new Error('Request timeout. Check if the backend service is running.')
      }
      if (error.message?.includes('Failed to fetch')) {
        throw new Error('Cannot connect to backend. Ensure the backend service is running.')
      }
      throw error
    }

    const data = await response.json()
    return this.convertToThreeJS(data)
  }

  /**
   * 从后端加载模型数据
   */
  static async loadModelData(projectId: string = this.DEFAULT_PROJECT_ID): Promise<BackendModelData> {
    const response = await fetch(`${this.BASE_URL}/${projectId}/model`)
    if (!response.ok) {
      throw new Error(`Load failed: ${response.statusText}`)
    }

    const data = await response.json()
    return this.convertToThreeJS(data)
  }

  /**
   * 删除后端模型数据
   */
  static async deleteModelData(projectId: string = this.DEFAULT_PROJECT_ID): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/${projectId}/model`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`)
    }
  }

  /**
   * 将后端数据转换为Three.js可用的格式
   */
  private static convertToThreeJS(data: any): BackendModelData {
    // 确保数据存在
    if (!data || !data.vertices || !Array.isArray(data.vertices)) {
      throw new Error('Invalid model data: missing vertex data')
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
      // 检查索引值范围，决定使用 Uint16 还是 Uint32（避免 Math.max(...arr) 大数组栈溢出）
      let maxIndex = 0
      for (let i = 0; i < data.indices.length; i++) {
        if (data.indices[i] > maxIndex) maxIndex = data.indices[i]
      }
      if (maxIndex < 65535) {
        indices = new Uint16Array(data.indices)
      } else {
        indices = new Uint32Array(data.indices)
      }
    }

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
      throw new Error('Invalid model data: missing vertex data')
    }

    if (modelData.vertices.length % 3 !== 0) {
      throw new Error(`Invalid model data: vertex count must be multiple of 3 (${modelData.vertices.length})`)
    }

    const vertexCount = modelData.vertices.length / 3

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
        throw new Error(`Invalid model data: index count must be multiple of 3 (${modelData.indices.length})`)
      }
      
      // 验证索引范围（避免 Math.max(...arr) 大数组栈溢出）
      let maxIndex = 0
      const idxArr = modelData.indices
      for (let i = 0; i < idxArr.length; i++) {
        if (idxArr[i] > maxIndex) maxIndex = idxArr[i]
      }
      if (maxIndex >= vertexCount) {
        console.error(`[Three.js] 索引超出范围: 最大索引 ${maxIndex}, 顶点数 ${vertexCount}`)
        throw new Error(`Invalid model data: index out of range (max index: ${maxIndex}, vertex count: ${vertexCount})`)
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
