using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class AppointmentNumberGenerator : IAppointmentNumberGenerator
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<AppointmentNumberGenerator> _logger;
    private static readonly SemaphoreSlim _lock = new(1, 1);

    public AppointmentNumberGenerator(ApplicationDbContext dbContext, ILogger<AppointmentNumberGenerator> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<string> GenerateNextAppointmentNumberAsync(CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            var year = DateTime.UtcNow.Year;
            var prefix = $"APT-{year}-";

            var currentYearNumbers = await _dbContext.Appointments
                .AsNoTracking()
                .Where(a => a.AppointmentNumber.StartsWith(prefix))
                .Select(a => a.AppointmentNumber)
                .ToListAsync(cancellationToken);

            int highestSequence = 0;
            foreach (var num in currentYearNumbers)
            {
                var suffix = num.Substring(prefix.Length);
                if (int.TryParse(suffix, out int parsedSeq) && parsedSeq > highestSequence)
                {
                    highestSequence = parsedSeq;
                }
            }

            int nextSequence = highestSequence + 1;
            var generatedNumber = $"{prefix}{nextSequence:D5}";
            _logger.LogInformation("Generated sequential appointment number: {AppointmentNumber}", generatedNumber);

            return generatedNumber;
        }
        finally
        {
            _lock.Release();
        }
    }
}
