def multi_genexpr(blog_posts):
    return (entry for blog_post in blog_posts for entry in blog_post.entry_set)
