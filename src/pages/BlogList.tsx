import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { assetUrl, Post, postsApi } from "@/lib/api";

const textExcerpt = (html: string) => {
  const container = document.createElement("div");
  container.innerHTML = html;
  const text = container.textContent || "";
  return text.length > 150 ? `${text.slice(0, 150)}...` : text;
};

export default function BlogList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setPosts(await postsApi.listPublic());
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-8 text-center">Nuestro Blog</h1>
        
        {loading ? (
          <p className="text-center text-slate-500">Cargando artículos...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-slate-500">Pronto publicaremos nuevos artículos.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link to={`/blog/${post.slug}`} key={post.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-slate-100 flex flex-col group">
                <div className="h-48 bg-slate-200 overflow-hidden relative">
                  {post.image_url ? (
                    <img src={assetUrl(post.image_url)} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">Sin Imagen</div>
                  )}
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <span className="text-sm text-blue-600 font-medium mb-2">{new Date(post.created_at).toLocaleDateString()}</span>
                  <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">{post.title}</h2>
                  <p className="text-slate-500 line-clamp-3">{textExcerpt(post.content)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
