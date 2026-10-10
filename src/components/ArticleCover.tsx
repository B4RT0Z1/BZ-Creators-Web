import { useState } from "react";
import { assetUrl } from "@/lib/api";
export function ArticleCover({ image, title }: { image: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return <figure className={image && !failed ? "article-cover has-image" : "article-cover"}>{image && !failed ? <img src={assetUrl(image)} alt={title} loading="lazy" decoding="async" onError={() => setFailed(true)}/> : <div className="article-cover-fallback"><span>BZ CREATORS</span><strong>{title}</strong><small>BITÁCORA DEL LABORATORIO</small></div>}</figure>;
}
