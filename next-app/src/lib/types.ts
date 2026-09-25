export type ArticleSource = "Seputar HMGF" | "SEG News" | "Geolibrary";

export type Article = {
  id: string;
  slug: string;
  title: string;
  image: string;
  author: string;
  date: string;
  category: string;
  contentType: string;
  semester: string;
  examType: string;
  courseType: string;
  course: string;
  link: string;
  paragraphs: string[];
  published: boolean;
  source: ArticleSource;
};

export type CommentInput = {
  name: string;
  email?: string;
  text: string;
  articleId: string;
  articleTitle: string;
  turnstileToken: string;
};
