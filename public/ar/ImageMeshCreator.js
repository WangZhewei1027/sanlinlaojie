/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 图片Mesh创建器
 * 负责创建带有图片纹理的3D平面
 */
class ImageMeshCreator {
  /**
   * 创建图片mesh
   * @param {Object} asset - 资产对象
   * @param {number} angle - 初始角度
   * @returns {THREE.Mesh} 图片mesh
   */
  static create(asset, angle) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = "anonymous";

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.angle = angle;
    mesh.userData.assetId = asset.id;
    mesh.userData.assetType = "image";

    // 加载纹理
    this.loadTexture(textureLoader, asset, mesh, material);

    return mesh;
  }

  /**
   * 加载图片纹理并调整mesh尺寸
   * @param {THREE.TextureLoader} textureLoader - 纹理加载器
   * @param {Object} asset - 资产对象
   * @param {THREE.Mesh} mesh - mesh对象
   * @param {THREE.MeshBasicMaterial} material - 材质对象
   */
  static loadTexture(textureLoader, asset, mesh, material) {
    textureLoader.load(
      asset.file_url,
      (texture) => {
        material.map = texture;
        material.needsUpdate = true;

        // 根据图片比例调整平面大小，保持原始比例
        this.adjustMeshSize(mesh, texture);

        console.log(
          `✅ Loaded image for asset ${asset.id}, aspect: ${(
            texture.image.width / texture.image.height
          ).toFixed(2)}`
        );
      },
      undefined,
      (error) => {
        console.error(
          `❌ Failed to load texture for asset ${asset.id}:`,
          error
        );
        material.color.setHex(0xff0000);
      }
    );
  }

  /**
   * 根据图片宽高比调整mesh尺寸
   * @param {THREE.Mesh} mesh - mesh对象
   * @param {THREE.Texture} texture - 纹理对象
   */
  static adjustMeshSize(mesh, texture) {
    const aspect = texture.image.width / texture.image.height;
    const baseSize = 0.7;

    if (aspect > 1) {
      // 横向图片
      mesh.scale.set(aspect * baseSize, baseSize, 1);
    } else {
      // 纵向图片
      mesh.scale.set(baseSize, baseSize / aspect, 1);
    }
  }
}
