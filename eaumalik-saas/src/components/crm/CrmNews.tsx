'use client';

import { useState } from 'react';
import { Send, Newspaper, Upload, X } from 'lucide-react';
import { publishNewsAction } from '@/app/actions/clientActions';
import { useToast } from '@/components/shared/ToastProvider';

export default function CrmNews() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const toast = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || publishing) return;
    setPublishing(true);

    const res = await publishNewsAction({ title, content, imageUrl: imageUrl || undefined });
    if (res.success) {
      toast('Actualité publiée avec succès !', 'success');
      setTitle('');
      setContent('');
      setImageUrl('');
    } else {
      toast('Erreur lors de la publication : ' + res.error, 'error');
    }
    setPublishing(false);
  };

  return (
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Publier une Actualité / Offre</h2>
      <div className="glass-card p-6 max-w-xl" style={{ transform: 'none' }}>
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <Newspaper size={18} className="text-primary-light" /> Nouvelle publication
        </h3>
        <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
          Les actualités publiées ici apparaissent immédiatement sur l&apos;espace client de tous vos parrains et acheteurs.
        </p>

        <form onSubmit={handlePublish} className="space-y-4">
          <div>
            <label className="form-label">Titre de l&apos;annonce *</label>
            <input
              type="text"
              required
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: -20% sur les recharges de filtres ce mois-ci !"
            />
          </div>
          <div>
            <label className="form-label">Contenu de l&apos;annonce *</label>
            <textarea
              required
              rows={4}
              className="form-input"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Écrivez le message complet ici..."
            />
          </div>

          <div>
            <label className="form-label">Photo d&apos;illustration (Optionnel)</label>
            <div className="flex gap-4 items-center mt-1">
              <label className="cursor-pointer btn-outline py-2 px-3 text-xs flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-card)]">
                <Upload size={14} /> Choisir une photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {imageUrl && (
                <div className="relative w-16 h-16 rounded border border-[color:var(--border)] overflow-hidden">
                  <img
                    src={imageUrl}
                    alt="Aperçu"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={publishing}
            className="btn-primary w-full justify-center py-2.5 text-sm disabled:opacity-50"
          >
            <Send size={14} /> {publishing ? 'Publication...' : 'Publier aux clients'}
          </button>
        </form>
      </div>
    </>
  );
}
