import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArticleCover } from "@/components/ArticleCover";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Post, postsApi } from "@/lib/api";

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
    <div className="min-h-screen lab-page flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 lab-shell pb-20 pt-36">
        <h1 className="text-4xl font-bold text-foreground mb-8 text-center">Bitácora del laboratorio</h1>

        {loading ? (
          <p className="text-center text-muted-foreground">Cargando artículos...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground">Pronto publicaremos nuevos artículos.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link to={`/blog/${post.slug}`} key={post.id} className="bg-card rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-border flex flex-col group">
                <ArticleCover key={post.image_url} image={post.image_url} title={post.title}/>
                <div className="p-6 flex-1 flex flex-col">
                  <span className="text-sm text-violet-400 font-medium mb-2">{new Date(post.created_at).toLocaleDateString()}</span>
                  <h2 className="text-xl font-bold text-foreground mb-2 group-hover:text-violet-400 transition-colors line-clamp-2">{post.title}</h2>
                  <p className="text-muted-foreground line-clamp-3">{textExcerpt(post.content)}</p>
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
