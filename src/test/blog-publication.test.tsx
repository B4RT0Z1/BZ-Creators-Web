import {afterEach,expect,it,vi} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import BlogList from "@/pages/BlogList";
import {postsApi,type Post} from "@/lib/api";
import {setArticleSeo} from "@/lib/article-seo";
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("shows publication date even when the draft was created days earlier",async()=>{
 const post={id:"one",slug:"one",title:"Published today",content:"<p>News.</p>",created_at:"2026-10-21T17:00:00Z",published_at:"2026-10-24T17:00:00Z",updated_at:"2026-10-24T17:00:00Z",published:true,image_url:null} as Post;
 vi.spyOn(postsApi,"listPublic").mockResolvedValue([post]);
 render(<MemoryRouter><BlogList/></MemoryRouter>);
 expect(await screen.findByText(new Date(post.published_at!).toLocaleDateString())).toBeVisible();
 expect(screen.queryByText(new Date(post.created_at).toLocaleDateString())).not.toBeInTheDocument();
 const clear=setArticleSeo(post);expect(document.head.querySelector('meta[property="article:published_time"]')).toHaveAttribute('content','2026-10-24T17:00:00.000Z');clear();
});
