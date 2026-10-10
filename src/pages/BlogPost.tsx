import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArticleCover } from "@/components/ArticleCover";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CommentsSection from "@/components/CommentsSection";
import { ArrowLeft } from "lucide-react";
import { Post, postsApi } from "@/lib/api";
import { setArticleSeo } from "@/lib/article-seo";

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setPost(null);
    if (!slug) { setLoading(false); return; }
    void postsApi.getPublic(slug).then(data => { if (active) setPost(data); })
      .catch(() => { if (active) setPost(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => post ? setArticleSeo(post) : undefined, [post]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  if (!post) return (
    <div className="min-h-screen flex flex-col items-center justify-center lab-page">
      <h1 className="text-2xl font-bold text-foreground mb-4">Post no encontrado</h1>
      <Link to="/blog" className="text-violet-400 hover:underline">Volver al blog</Link>
    </div>
  );

  return (
    <div className="min-h-screen lab-page flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 w-full pt-32">
        <div className="max-w-4xl mx-auto px-4 relative z-10 pb-12 bz-article">
          <div className="bg-card rounded-2xl shadow-xl p-5 sm:p-8 md:p-12">
            <Link to="/blog" className="inline-flex items-center text-violet-400 hover:text-violet-300 mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver a artículos
            </Link>

            <p className="article-kicker">BZ CREATORS / BITÁCORA</p>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">{post.title}</h1>

            <div className="flex items-center text-muted-foreground mb-8 pb-8 border-b border-border">
              <span>Publicado el {new Date(post.created_at).toLocaleDateString()}</span>
            </div>

            <ArticleCover key={post.image_url} image={post.image_url} title={post.title}/>

            {/* The dangerouslySetInnerHTML is required because quill saves HTML */}
            <div
              className="bz-article-content"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>
        </div>

        {/* Comments Section — dark themed, full width strip */}
        <div className="bg-[hsl(0_0%_4%)] py-16 border-t border-[hsl(0_0%_12%)]">
          <div className="max-w-4xl mx-auto px-4">
            <CommentsSection postId={post.id} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
