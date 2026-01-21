"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ModelViewerProps {
    glbBase64?: string;
    glbUrl?: string;
}

export function ModelViewer({ glbBase64, glbUrl }: ModelViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const modelRef = useRef<THREE.Group | null>(null);
    const animationFrameRef = useRef<number>(0);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize Three.js scene
    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Scene - lighter background
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x303030);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 0.5, 2.5);
        cameraRef.current = camera;

        // Renderer with neutral tone mapping
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1;
        controls.maxDistance = 5;
        controls.target.set(0, 0, 0);
        controlsRef.current = controls;

        // Studio-style 3-point lighting for natural look
        // Soft ambient fill
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // Hemisphere light for natural sky/ground gradient
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        hemiLight.position.set(0, 20, 0);
        scene.add(hemiLight);

        // Key light - main light from front-right
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(3, 4, 5);
        scene.add(keyLight);

        // Fill light - softer from front-left
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
        fillLight.position.set(-3, 2, 4);
        scene.add(fillLight);

        // Rim/back light - for edge definition
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
        rimLight.position.set(0, 3, -5);
        scene.add(rimLight);

        // Bottom fill to reduce harsh shadows
        const bottomFill = new THREE.DirectionalLight(0xffffff, 0.3);
        bottomFill.position.set(0, -3, 2);
        scene.add(bottomFill);

        // Animation loop
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Resize handler
        const handleResize = () => {
            if (!container) return;
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(animationFrameRef.current);
            controls.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    // Load GLB model
    useEffect(() => {
        if (!sceneRef.current) return;
        if (!glbBase64 && !glbUrl) return;

        setIsLoading(true);
        setError(null);

        const loader = new GLTFLoader();

        // Remove existing model
        if (modelRef.current) {
            sceneRef.current.remove(modelRef.current);
            modelRef.current.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (child.material instanceof THREE.Material) {
                        child.material.dispose();
                    } else if (Array.isArray(child.material)) {
                        child.material.forEach((m) => m.dispose());
                    }
                }
            });
            modelRef.current = null;
        }

        const loadModel = async () => {
            try {
                let modelUrl: string;

                if (glbBase64) {
                    // Convert base64 to blob URL
                    const binaryString = atob(glbBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const blob = new Blob([bytes], { type: "model/gltf-binary" });
                    modelUrl = URL.createObjectURL(blob);
                } else if (glbUrl) {
                    modelUrl = glbUrl;
                } else {
                    throw new Error("No model provided");
                }

                const gltf = await new Promise<GLTF>((resolve, reject) => {
                    loader.load(modelUrl, resolve, undefined, reject);
                });

                // Clean up blob URL
                if (glbBase64) {
                    URL.revokeObjectURL(modelUrl);
                }

                const model = gltf.scene;

                // Fix material settings for proper color rendering
                model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const material = child.material as THREE.MeshStandardMaterial;
                        if (material.isMeshStandardMaterial) {
                            // Ensure texture color space is correct
                            if (material.map) {
                                material.map.colorSpace = THREE.SRGBColorSpace;
                            }
                            // Keep natural roughness but ensure minimum reflectivity
                            material.roughness = Math.max(0.3, Math.min(material.roughness, 0.8));
                            material.metalness = Math.min(material.metalness, 0.1);
                            material.needsUpdate = true;
                        }
                    }
                });

                // Center and scale the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 1.5 / maxDim;
                model.scale.setScalar(scale);

                model.position.sub(center.multiplyScalar(scale));

                sceneRef.current!.add(model);
                modelRef.current = model;

                // Adjust camera to fit model
                if (cameraRef.current && controlsRef.current) {
                    cameraRef.current.position.set(0, 0.5, 2.5);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                }

                setIsLoading(false);
            } catch (err) {
                console.error("Error loading model:", err);
                setError(err instanceof Error ? err.message : "Failed to load model");
                setIsLoading(false);
            }
        };

        loadModel();
    }, [glbBase64, glbUrl]);

    return (
        <Card className="aspect-square p-0 overflow-hidden">
            <div
                ref={containerRef}
                className="w-full h-full bg-zinc-900 relative"
            >
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-zinc-900">
                        <Loader2 className="h-8 w-8 animate-spin text-white mb-2" />
                        <div className="text-white text-sm">Loading 3D model...</div>
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-900">
                        <div className="text-red-400 text-sm text-center px-4">{error}</div>
                    </div>
                )}
                {!glbBase64 && !glbUrl && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-900">
                        <div className="text-zinc-500 text-sm">No 3D model loaded</div>
                    </div>
                )}
            </div>
        </Card>
    );
}

