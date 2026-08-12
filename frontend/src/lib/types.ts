export type Segment = { text: string; start: number; duration: number };

export type CourseEntry = {
  id: string;
  video_id: string;
  thumbnail_url: string;
  sections: { title: string }[];
};
