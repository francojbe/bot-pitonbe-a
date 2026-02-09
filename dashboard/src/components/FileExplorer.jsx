import React, { useState, useEffect, useRef } from 'react';
import {
    Folder,
    File,
    Search,
    Upload,
    Download,
    Trash2,
    ChevronRight,
    MoreVertical,
    ArrowLeft,
    FileText,
    Image as ImageIcon,
    ExternalLink,
    Tag
} from 'lucide-react';
import { supabase } from '../supabase';
import { toast } from 'sonner';

export default function FileExplorer() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPath, setCurrentPath] = useState([]); // Array of folder names
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const BACKEND_URL = import.meta.env.VITE_API_URL;

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/storage/tree`);
            if (response.ok) {
                const data = await response.json();
                setFiles(data);
            }
        } catch (error) {
            console.error("Error fetching files:", error);
            toast.error("Error al cargar archivos");
        } finally {
            setLoading(false);
        }
    };

    // Logic to build the folder tree from flat metadata
    const buildTree = () => {
        const root = {};
        files.forEach(file => {
            let parts = file.file_path.split('/');
            // Si la ruta empieza con 'archivos/', omitimos ese primer nivel para evitar redundancia
            if (parts[0] === 'archivos') {
                parts.shift();
            }

            let current = root;
            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = {
                        name: part,
                        type: index === parts.length - 1 ? 'file' : 'folder',
                        children: {},
                        metadata: index === parts.length - 1 ? file : null
                    };
                }
                current = current[part].children;
            });
        });
        return root;
    };

    const getVisibleItems = () => {
        let current = buildTree();

        // Navigate to current path
        for (const folder of currentPath) {
            if (current[folder]) {
                current = current[folder].children;
            }
        }

        const items = Object.values(current).map(item => ({
            ...item,
            isFolder: item.type === 'folder'
        }));

        if (searchQuery) {
            return items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return items;
    };

    const handleFolderClick = (folderName) => {
        setCurrentPath([...currentPath, folderName]);
        setSelectedFile(null);
    };

    const handleBack = () => {
        setCurrentPath(currentPath.slice(0, -1));
        setSelectedFile(null);
    };

    const getFileIcon = (mimeType) => {
        if (mimeType?.includes('pdf')) return <FileText className="text-red-500" />;
        if (mimeType?.includes('image')) return <ImageIcon className="text-blue-500" />;
        return <File className="text-gray-500" />;
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (currentPath.length === 0) {
            toast.error("Por favor selecciona una carpeta de cliente para subir el archivo");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', `archivos/${currentPath.join('/')}`);

        setUploading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/storage/upload`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                toast.success("Archivo subido con éxito");
                fetchFiles();
            } else {
                toast.error("Error al subir archivo");
            }
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Error de conexión");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteFile = async (fileId) => {
        if (!confirm("¿Estás seguro de que quieres eliminar este archivo?")) return;

        try {
            const response = await fetch(`${BACKEND_URL}/storage/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: fileId })
            });

            if (response.ok) {
                toast.success("Archivo eliminado");
                setSelectedFile(null); // Close sidebar
                fetchFiles(); // Refresh list
            } else {
                toast.error("Error al eliminar archivo");
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Error de conexión");
        }
    };

    const visibleItems = getVisibleItems();

    return (
        <div className="flex h-full bg-[var(--bg-subtle)] overflow-hidden">
            {/* Main Explorer Area */}
            <div className={`flex-1 flex flex-col min-w-0 ${selectedFile ? 'mr-80' : ''} transition-all`}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#1a1a1a]">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                            <Folder className="text-[var(--color-primary)]" />
                            PitonB Drive
                        </h1>
                        <div className="hidden md:flex items-center bg-[var(--bg-subtle)] rounded-lg px-3 py-1.5 border border-gray-200 dark:border-white/10">
                            <Search size={16} className="text-gray-400 mr-2" />
                            <input
                                type="text"
                                placeholder="Buscar archivos..."
                                className="bg-transparent border-none focus:ring-0 text-sm w-48"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 disabled:opacity-50"
                            title="Subir"
                        >
                            {uploading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500"></div>
                            ) : (
                                <Upload size={20} />
                            )}
                        </button>
                        <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500" title="Vista">
                            <MoreVertical size={20} />
                        </button>
                    </div>
                </div>

                {/* Breadcrumbs */}
                <div className="px-4 py-2 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] flex items-center gap-2 overflow-x-auto">
                    <button
                        onClick={() => setCurrentPath([])}
                        className="text-xs font-medium text-gray-500 hover:text-[var(--color-primary)]"
                    >
                        Mis Archivos
                    </button>
                    {currentPath.map((part, idx) => (
                        <React.Fragment key={idx}>
                            <ChevronRight size={14} className="text-gray-400" />
                            <button
                                onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))}
                                className="text-xs font-medium text-gray-500 hover:text-[var(--color-primary)] whitespace-nowrap"
                            >
                                {part}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
                        </div>
                    ) : visibleItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Folder className="w-16 h-16 opacity-20 mb-4" />
                            <p>No hay archivos en esta carpeta</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {currentPath.length > 0 && searchQuery === '' && (
                                <div
                                    onClick={handleBack}
                                    className="flex flex-col items-center p-4 rounded-xl hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/10 group"
                                >
                                    <div className="w-16 h-16 flex items-center justify-center">
                                        <ArrowLeft className="text-gray-400 group-hover:text-[var(--color-primary)]" size={32} />
                                    </div>
                                    <span className="mt-2 text-xs font-medium text-gray-500">Volver</span>
                                </div>
                            )}

                            {visibleItems.map((item, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => item.isFolder ? handleFolderClick(item.name) : setSelectedFile(item.metadata)}
                                    className={`flex flex-col items-center p-4 rounded-xl cursor-pointer transition-all border ${selectedFile?.id === item.metadata?.id
                                        ? 'bg-white dark:bg-white/10 border-[var(--color-primary)] shadow-md'
                                        : 'hover:bg-white dark:hover:bg-white/5 border-transparent hover:border-gray-200 dark:hover:border-white/10'
                                        } group`}
                                >
                                    <div className="w-16 h-16 flex items-center justify-center">
                                        {item.isFolder ? (
                                            <Folder className="text-amber-400 fill-amber-400" size={48} />
                                        ) : (
                                            getFileIcon(item.metadata?.file_type)
                                        )}
                                    </div>
                                    <span className="mt-2 text-xs font-medium text-[var(--text-main)] text-center line-clamp-2 break-all">
                                        {item.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Details Side Panel */}
            {selectedFile && (
                <div className="w-80 border-l border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] fixed right-0 top-0 bottom-0 z-20 shadow-xl flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                        <h2 className="font-bold text-[var(--text-main)]">Detalles del Archivo</h2>
                        <button onClick={() => setSelectedFile(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">
                            <ChevronRight />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {/* Preview (Mockup for now, could use Supabase Public URL) */}
                        <div className="aspect-square bg-gray-100 dark:bg-white/5 rounded-xl mb-4 flex items-center justify-center border border-gray-200 dark:border-white/10 overflow-hidden">
                            {selectedFile.file_type?.includes('image') ? (
                                <img
                                    src={supabase.storage.from("chat-media").getPublicUrl(selectedFile.file_path).data.publicUrl}
                                    alt="preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <FileText className="w-16 h-16 text-gray-300" />
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nombre</label>
                                <p className="text-sm font-medium text-[var(--text-main)] break-all">{selectedFile.file_name}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estado</label>
                                <div className="mt-1">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${selectedFile.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {selectedFile.status}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliente</label>
                                <p className="text-sm font-medium text-[var(--text-main)]">{selectedFile.leads?.name || '---'}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Subido el</label>
                                <p className="text-sm font-medium text-[var(--text-main)]">
                                    {new Date(selectedFile.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/10 grid grid-cols-2 gap-2">
                        <a
                            href={supabase.storage.from("chat-media").getPublicUrl(selectedFile.file_path).data.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-bold"
                        >
                            <Download size={16} /> Abrir
                        </a>
                        <button
                            onClick={() => handleDeleteFile(selectedFile.id)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                            <Trash2 size={16} /> Borrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
