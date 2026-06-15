using AhorcadoPro.Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace AhorcadoPro.Backend.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<Word> Words { get; set; }
        public DbSet<Score> Scores { get; set; }
        public DbSet<WordList> WordLists { get; set; }
        public DbSet<WordListItem> WordListItems { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<Word>(e => {
                e.ToTable("words");
                e.Property(w => w.Id).HasColumnName("id");
                e.Property(w => w.Text).HasColumnName("text");
                e.Property(w => w.Category).HasColumnName("category");
                e.Property(w => w.Difficulty).HasColumnName("difficulty");
                e.Property(w => w.IsActive).HasColumnName("is_active");
                e.Property(w => w.TargetProfile).HasColumnName("target_profile");
                e.Property(w => w.GradeLevel).HasColumnName("grade_level");
                e.Property(w => w.CreatedAt).HasColumnName("created_at");
            });

            builder.Entity<Score>(e => {
                e.ToTable("scores");
                e.Property(s => s.Id).HasColumnName("id");
                e.Property(s => s.UserId).HasColumnName("user_id");
                e.Property(s => s.GuestAlias).HasColumnName("guest_alias");
                e.Property(s => s.Points).HasColumnName("points");
                e.Property(s => s.Mode).HasColumnName("mode");
                e.Property(s => s.Word).HasColumnName("word");
                e.Property(s => s.Category).HasColumnName("category");
                e.Property(s => s.Won).HasColumnName("won");
                e.Property(s => s.AttemptsUsed).HasColumnName("attempts_used");
                e.Property(s => s.MaxAttempts).HasColumnName("max_attempts");
                e.Property(s => s.DurationSeconds).HasColumnName("duration_seconds");
                e.Property(s => s.CreatedAt).HasColumnName("created_at");
            });

            builder.Entity<WordList>(e => {
                e.ToTable("word_lists");
                e.Property(w => w.Id).HasColumnName("id");
                e.Property(w => w.Name).HasColumnName("name");
                e.Property(w => w.OwnerAlias).HasColumnName("owner_alias");
                e.Property(w => w.JoinCode).HasColumnName("join_code");
                e.Property(w => w.CreatedAt).HasColumnName("created_at");
            });

            builder.Entity<WordListItem>(e => {
                e.ToTable("word_list_items");
                e.Property(i => i.Id).HasColumnName("id");
                e.Property(i => i.WordListId).HasColumnName("word_list_id");
                e.Property(i => i.Text).HasColumnName("text");
                e.Property(i => i.Definition).HasColumnName("definition");
                e.Property(i => i.Category).HasColumnName("category");
                e.Property(i => i.Position).HasColumnName("position");
                e.HasOne(i => i.WordList)
                 .WithMany(w => w.Items)
                 .HasForeignKey(i => i.WordListId)
                 .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
