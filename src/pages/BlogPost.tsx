import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CommentsSection from "@/components/CommentsSection";
import { ArrowLeft } from "lucide-react";
import { assetUrl, Post, postsApi } from "@/lib/api";

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        if (!slug) return;
        const data = await postsApi.getPublic(slug);
        setPost(data);
        // SEO logic
        document.title = data.title + " | BZ Creators";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.setAttribute('name', 'description');
          document.head.appendChild(metaDesc);
        }
        // Use meta_description if it exists, otherwise extract plain text from content
        const plainTextContent = data.content.replace(/<[^>]+>/g, '').substring(0, 160) + '...';
        metaDesc.setAttribute('content', data.meta_description || plainTextContent);

        if (data.keywords) {
          let metaKeywords = document.querySelector('meta[name="keywords"]');
          if (!metaKeywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.setAttribute('name', 'keywords');
            document.head.appendChild(metaKeywords);
          }
          metaKeywords.setAttribute('content', data.keywords);
        }
      } catch {
        setPost(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [slug]);

  // Clean up title on unmount
  useEffect(() => {
    return () => { document.title = "BZ Creators"; };
  }, []);

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
        <div className="max-w-4xl mx-auto px-4 relative z-10 pb-12">
          <div className="bg-card rounded-2xl shadow-xl p-5 sm:p-8 md:p-12">
            <Link to="/blog" className="inline-flex items-center text-violet-400 hover:text-violet-300 mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver a artículos
            </Link>

            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">{post.title}</h1>

            <div className="flex items-center text-muted-foreground mb-8 pb-8 border-b border-border">
              <span>Publicado el {new Date(post.created_at).toLocaleDateString()}</span>
            </div>

            {post.image_url && (
              <div className="w-full rounded-2xl overflow-hidden mb-10 shadow-sm border border-border">
                <img src={assetUrl(post.image_url)} alt={post.title} className="w-full h-auto object-cover max-h-[500px]" />
              </div>
            )}

            {/* The dangerouslySetInnerHTML is required because quill saves HTML */}
            <div
              className="prose prose-invert prose-lg max-w-none
                         text-foreground [&_*]:!text-foreground [&_a]:!text-violet-400 hover:[&_a]:!text-violet-300
                         prose-headings:font-bold prose-headings:!text-foreground
                         prose-img:rounded-xl prose-img:shadow-md"
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
