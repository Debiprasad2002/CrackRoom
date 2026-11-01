from django.urls import path

from . import views

urlpatterns = [
    path('community/posts/', views.FeedView.as_view(), name='community-feed'),
    path('community/posts/<int:post_id>/', views.PostDetailView.as_view(), name='community-post'),
    path('community/posts/<int:post_id>/reshare/', views.ReshareView.as_view(), name='community-reshare'),
    path('community/posts/<int:post_id>/react/', views.ReactView.as_view(), name='community-react'),
    path('community/posts/<int:post_id>/report/', views.ReportPostView.as_view(), name='community-report'),
    path('community/posts/<int:post_id>/comments/', views.CommentsView.as_view(), name='community-comments'),
    path('community/comments/<int:comment_id>/', views.CommentDetailView.as_view(), name='community-comment'),
    path('community/comments/<int:comment_id>/report/', views.ReportCommentView.as_view(), name='community-comment-report'),
]
