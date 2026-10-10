using System.Net;
using System.Text.Json;

namespace HospitalApp.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred while processing request {Path}", context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        
        var statusCode = exception switch
        {
            KeyNotFoundException => HttpStatusCode.NotFound,
            UnauthorizedAccessException => HttpStatusCode.Unauthorized,
            InvalidOperationException => HttpStatusCode.Conflict,
            ArgumentException => HttpStatusCode.BadRequest,
            _ => HttpStatusCode.InternalServerError
        };

        context.Response.StatusCode = (int)statusCode;

        var errorCode = exception switch
        {
            KeyNotFoundException => "RESOURCE_NOT_FOUND",
            UnauthorizedAccessException => "UNAUTHORIZED",
            InvalidOperationException => "CONFLICT_OR_INVALID_OPERATION",
            ArgumentException => "VALIDATION_FAILED",
            _ => "INTERNAL_SERVER_ERROR"
        };

        var response = new
        {
            error = new
            {
                code = errorCode,
                message = statusCode == HttpStatusCode.InternalServerError 
                    ? "An unexpected error occurred. Please contact the system administrator." 
                    : exception.Message,
                field_errors = Array.Empty<string>(),
                request_id = context.TraceIdentifier,
                timestamp = DateTime.UtcNow
            }
        };

        var json = JsonSerializer.Serialize(response);
        return context.Response.WriteAsync(json);
    }
}
