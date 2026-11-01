from django.db import IntegrityError, transaction
from django.db.models import Count, OuterRef, Q, Subquery
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Comment, Post, PostReport, Reaction
from .serializers import CommentSerializer, CreatePostSerializer, PostReportSerializer, PostSerializer, ReactSerializer

PAGE = 20

FeedPage = inline_serializer('FeedPage', {'results': PostSerializer(many=True), 'next': serializers.IntegerField(allow_null=True)})


def feed_queryset(user):
    """Visible posts with their counts and this student's reaction, in one query."""
    mine = Reaction.objects.filter(post=OuterRef('pk'), user=user).values('kind')[:1]
    return (
        Post.objects.filter(is_hidden=False, author__is_active=True)
        .select_related('author__profile', 'reshare_of__author__profile')
        .annotate(
            n_like=Count('reactions', filter=Q(reactions__kind='like'), distinct=True),
            n_fire=Count('reactions', filter=Q(reactions__kind='fire'), distinct=True),
            n_idea=Count('reactions', filter=Q(reactions__kind='idea'), distinct=True),
            n_reshares=Count('reshares', filter=Q(reshares__is_hidden=False), distinct=True),
            n_comments=Count('comments', filter=Q(comments__is_hidden=False), distinct=True),
            my_reaction=Subquery(mine),
        )
    )


def require_profile(user):
    if not hasattr(user, 'profile'):
        raise PermissionDenied('Finish onboarding before posting.')


def serialize(request, post_id):
    return PostSerializer(feed_queryset(request.user).get(pk=post_id), context={'request': request}).data


class FeedView(APIView):
    """Newest first, 20 at a time. Pass `before=<id>` from the previous page's `next`."""

    def get_throttles(self):
        self.throttle_scope = 'community_post' if self.request.method == 'POST' else None
        return super().get_throttles()

    @extend_schema(parameters=[OpenApiParameter('before', int), OpenApiParameter('mine', bool)], responses=FeedPage)
    def get(self, request):
        posts = feed_queryset(request.user)
        before = request.query_params.get('before')
        if before:
            if not before.isdigit():
                raise ValidationError({'before': ['Must be a post id.']})
            posts = posts.filter(id__lt=int(before))
        if request.query_params.get('mine') in {'1', 'true'}:
            posts = posts.filter(author=request.user)
        page = list(posts.order_by('-id')[: PAGE + 1])
        return Response({
            'results': PostSerializer(page[:PAGE], many=True, context={'request': request}).data,
            'next': page[PAGE - 1].id if len(page) > PAGE else None,
        })

    @extend_schema(request=CreatePostSerializer, responses={201: PostSerializer})
    def post(self, request):
        require_profile(request.user)
        serializer = CreatePostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        body = serializer.validated_data['body']
        if not body:
            raise ValidationError({'body': ['Write something first.']})
        post = Post.objects.create(author=request.user, body=body)
        return Response(serialize(request, post.id), status=status.HTTP_201_CREATED)


def visible_post(post_id) -> Post:
    post = Post.objects.filter(pk=post_id, is_hidden=False).select_related('reshare_of').first()
    if post is None:
        raise NotFound('This post is no longer available.')
    return post


class PostDetailView(APIView):
    @extend_schema(request=None, responses={204: None})
    def delete(self, request, post_id):
        """Authors can delete their own posts; staff can delete any. Reshares keep a 'removed' card."""
        post = Post.objects.filter(pk=post_id).first()
        if post is None:
            raise NotFound('This post is no longer available.')
        if post.author_id != request.user.id and not request.user.is_staff:
            raise PermissionDenied('You can only delete your own posts.')
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReshareView(APIView):
    throttle_scope = 'community_post'

    @extend_schema(request=CreatePostSerializer, responses={201: PostSerializer})
    def post(self, request, post_id):
        """Shares a post to the feed, with an optional comment on top."""
        require_profile(request.user)
        target = visible_post(post_id)
        original = target.reshare_of if target.is_reshare else target
        if original is None or original.is_hidden:
            raise ValidationError({'detail': 'The original post was removed.'})
        serializer = CreatePostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                post = Post.objects.create(
                    author=request.user, body=serializer.validated_data['body'], reshare_of=original, is_reshare=True
                )
        except IntegrityError:
            raise ValidationError({'detail': 'You have already reshared this post.'})
        return Response(serialize(request, post.id), status=status.HTTP_201_CREATED)


class ReactView(APIView):
    @extend_schema(request=ReactSerializer, responses=PostSerializer)
    def post(self, request, post_id):
        """Sets this student's reaction, replacing any earlier one."""
        post = visible_post(post_id)
        serializer = ReactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Reaction.objects.update_or_create(post=post, user=request.user, defaults={'kind': serializer.validated_data['kind']})
        return Response(serialize(request, post.id))

    @extend_schema(request=None, responses=PostSerializer)
    def delete(self, request, post_id):
        post = visible_post(post_id)
        Reaction.objects.filter(post=post, user=request.user).delete()
        return Response(serialize(request, post.id))


class ReportPostView(APIView):
    throttle_scope = 'report'

    @extend_schema(request=PostReportSerializer, responses={201: None})
    def post(self, request, post_id):
        post = visible_post(post_id)
        if post.author_id == request.user.id:
            raise ValidationError({'detail': 'You cannot report your own post. Delete it instead.'})
        serializer = PostReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if PostReport.objects.filter(post=post, comment__isnull=True, reporter=request.user, status=PostReport.Status.OPEN).exists():
            return Response({'detail': 'You have already reported this post. Moderators will review it.'}, status=status.HTTP_409_CONFLICT)
        serializer.save(post=post, reporter=request.user)
        return Response(status=status.HTTP_201_CREATED)


MAX_COMMENTS = 300


class CommentsView(APIView):
    """A post's comments, oldest first, and adding one."""

    def get_throttles(self):
        self.throttle_scope = 'community_comment' if self.request.method == 'POST' else None
        return super().get_throttles()

    @extend_schema(responses=CommentSerializer(many=True))
    def get(self, request, post_id):
        post = visible_post(post_id)
        comments = (
            post.comments.filter(is_hidden=False, author__is_active=True)
            .select_related('author__profile', 'post')
            .order_by('-id')[:MAX_COMMENTS]
        )
        return Response(CommentSerializer(list(reversed(list(comments))), many=True, context={'request': request}).data)

    @extend_schema(request=CommentSerializer, responses={201: CommentSerializer})
    def post(self, request, post_id):
        require_profile(request.user)
        post = visible_post(post_id)
        serializer = CommentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(post=post, author=request.user)
        return Response(CommentSerializer(comment, context={'request': request}).data, status=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    @extend_schema(request=None, responses={204: None})
    def delete(self, request, comment_id):
        comment = Comment.objects.select_related('post').filter(pk=comment_id).first()
        if comment is None:
            raise NotFound('This comment is no longer available.')
        user = request.user
        if not (user.is_staff or comment.author_id == user.id or comment.post.author_id == user.id):
            raise PermissionDenied('You can only remove your own comments or comments on your post.')
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportCommentView(APIView):
    throttle_scope = 'report'

    @extend_schema(request=PostReportSerializer, responses={201: None})
    def post(self, request, comment_id):
        comment = Comment.objects.select_related('post').filter(pk=comment_id, is_hidden=False).first()
        if comment is None:
            raise NotFound('This comment is no longer available.')
        if comment.author_id == request.user.id:
            raise ValidationError({'detail': 'You cannot report your own comment. Delete it instead.'})
        serializer = PostReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if PostReport.objects.filter(comment=comment, reporter=request.user, status=PostReport.Status.OPEN).exists():
            return Response({'detail': 'You have already reported this comment.'}, status=status.HTTP_409_CONFLICT)
        serializer.save(post=comment.post, comment=comment, reporter=request.user)
        return Response(status=status.HTTP_201_CREATED)
